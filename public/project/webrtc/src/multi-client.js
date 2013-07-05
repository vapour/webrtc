define(function (require, exports, module) {
    require('./adapter');

    var util = {
        parseURL: function (url) {
            var a =  document.createElement('a');
            a.href = url;
            return {
                source: url,
                protocol: a.protocol.replace(':',''),
                host: a.hostname,
                port: a.port,
                query: a.search,
                params: (function(){
                    var ret = {},
                    seg = a.search.replace(/^\?/,'').split('&'),
                    len = seg.length, i = 0, s;
                    for (;i<len;i++) {
                        if (!seg[i]) { continue; }
                        s = seg[i].split('=');
                        ret[s[0]] = s[1];
                    }
                    return ret;
                })(),
                file: (a.pathname.match(/\/([^\/?#]+)$/i) || [,''])[1],
                hash: a.hash.replace('#',''),
                path: a.pathname.replace(/^([^\/])/,'/$1')
            };
        },
        mergeConstraints: function (cons1, cons2) {
            var merged = cons1;
            for (var name in cons2.mandatory) {
                merged.mandatory[name] = cons2.mandatory[name];
            }
            merged.optional.concat(cons2.optional);
            return merged;
        },
        preferOpus: function (sdp) {
            var sdpLines = sdp.split('\r\n');
            var mLineIndex = null;

            // Search for m line.
            for (var i = 0; i < sdpLines.length; i++) {
                if (sdpLines[i].search('m=audio') !== -1) {
                    mLineIndex = i;
                    break;
                }
            }
            if (mLineIndex === null) return sdp;

            // If Opus is available, set it as the default in m line.
            for (var i = 0; i < sdpLines.length; i++) {
                if (sdpLines[i].search('opus/48000') !== -1) {
                    var opusPayload = this.extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
                    if (opusPayload)
                        sdpLines[mLineIndex] = this.setDefaultCodec(sdpLines[mLineIndex], opusPayload);
                    break;
                }
            }

            // Remove CN in m line and sdp.
            sdpLines = this.removeCN(sdpLines, mLineIndex);

            sdp = sdpLines.join('\r\n');
            return sdp;

        },
        extractSdp: function (sdpLine, pattern) {
            var result = sdpLine.match(pattern);
            return (result && result.length == 2)? result[1]: null;
        },
        // Set the selected codec to the first in m line.
        setDefaultCodec: function (mLine, payload) {
            var elements = mLine.split(' ');
            var newLine = [];
            var index = 0;
            for (var i = 0; i < elements.length; i++) {
                if (index === 3) // Format of media starts from the fourth.
                    newLine[index++] = payload; // Put target payload to the first.
                if (elements[i] !== payload)
                    newLine[index++] = elements[i];
            }
            return newLine.join(' ');
        },
        // Strip CN from sdp before CN constraints is ready.
        removeCN: function (sdpLines, mLineIndex) {
            var mLineElements = sdpLines[mLineIndex].split(' ');
            // Scan from end for the convenience of removing an item.
            for (var i = sdpLines.length-1; i >= 0; i--) {
                var payload = this.extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
                if (payload) {
                    var cnPos = mLineElements.indexOf(payload);
                    if (cnPos !== -1) {
                        // Remove CN payload from m line.
                        mLineElements.splice(cnPos, 1);
                    }
                    // Remove CN line in sdp
                    sdpLines.splice(i, 1);
                }
            }

            sdpLines[mLineIndex] = mLineElements.join(' ');
            return sdpLines;
        }
    }


    var socket = io.connect('http://' + location.host);

    

    var btnStart, btnCall, btnHangUp, vidLocal, vidRemote;
    var localStream, pc2, sdpConstraints, servers;
    var started = false;

    var config = {
        pc_config: {"iceServers": [{"url": "stun:stun.l.google.com:19302"}]},
        pc_constraints: {"optional": [{"DtlsSrtpKeyAgreement": true}]},
        sdpConstraints: {
            mandatory: {
                OfferToReceiveAudio: true,
                OfferToReceiveVideo: true
            }
        }
    };

    var webRTC = {
        init: function () {
            btnStart = $('#btnStart');
            btnCall = $('#btnCall');
            btnHangUp = $('#btnHangUp');

            vidLocal = $('#vidLocal');
            vidRemote = $('#vidRemote');
            
            btnStart.attr('disabled', false);
            btnCall.attr('disabled', true);
            btnHangUp.attr('disabled', true);

            config.room = util.parseURL(window.location.href).params.room;
            config.guest = config.room ? 1 : 0;

            webRTC.start();
            this.bind();
        },
        bind: function () {
            var self = this;
            btnStart.click(function (ev) {
                self.start();
            });
            btnCall.click(function (ev) {
                self.call();
            });
            btnHangUp.click(function (ev) {
                self.hangUp();
            });

            socket.on('message', function (data) {
                webRTC.handleMessages(data);
            });


        },
        handleMessages: function (data) {
            console.log(data.type, data);
            switch(data.type) {
                case 'GETROOM':
                    config.room = data.room;
                    break;
                case "candidate" :
                    var candidate = new RTCIceCandidate({
                        sdpMLineIndex:data.label,
                        candidate:data.candidate
                    });
                    pc1.addIceCandidate(candidate);
                    break;
                case "offer" :
                    // Callee creates PeerConnection
                    if (!config.guest && !started) webRTC.call();

                    pc1.setRemoteDescription(new RTCSessionDescription(data));
                    webRTC.createAnswer();
                    break;
                case "answer" :
                    pc1.setRemoteDescription(new RTCSessionDescription(data));
                break;
            }
        },
        //加入房间
        invite: function () {
            socket.emit('send', {"type" : "INVITE", "value" : config.room});
        },
        createAnswer: function () {
            pc1.createAnswer(function (sd) {
                console.log('createAnswer');
                webRTC.setLocalAndSendMessage(sd);
                
            }, null, config.sdpConstraints);
        },
        //客人发起视频请求
        createOffer: function () {
            var constraints = {"optional": [], "mandatory": {"MozDontOfferDataChannel": true}};
            //constraints = util.mergeConstraints(constraints, config.sdpConstraints);
            console.log(pc1, "Sending offer to peer ");
            //pc1.createOffer(webRTC.setLocalAndSendMessage, null, constraints);
            pc1.createOffer(function (sd) {
                console.log('createOffer');
                webRTC.setLocalAndSendMessage(sd);
            }, null, config.sdpConstraints);
        },
        setLocalAndSendMessage: function (sessionDescription) {
            console.log(sessionDescription);
            // Set Opus as the preferred codec in SDP if Opus is present.
            sessionDescription.sdp = util.preferOpus(sessionDescription.sdp);
            pc1.setLocalDescription(sessionDescription);
            console.log('ddddddddd');
            socket.emit('send', sessionDescription);
        },
        hangUp: function () {
            pc1.close(); 
            pc1 = null;
            btnHangUp.attr('disabled', true);
            btnCall.attr('disabled', false);
        },
        start: function () {
            btnStart.attr('disabled', true);

            getUserMedia({
                audio: true,
                video: true
            }, function (stream) {
                attachMediaStream(vidLocal[0], stream);
                localStream = stream;
                btnCall.attr('disabled', false);

                if (config.guest) {
                    webRTC.invite();
                    webRTC.call();
                } else {
                    socket.emit('send', {type: 'GETROOM', value: ''});
                }
            }, function () {});
        },
        call: function () {
            if (started) return;

            started = true;
            btnCall.attr('disabled', true);
            btnHangUp.attr('disabled', false);

            pc1 = new RTCPeerConnection(config.pc_config, config.pc_constraints);

            pc1.onicecandidate = function (ev) {
                if (ev.candidate) {
                    socket.emit('send', {
                        type: 'candidate',
                        label: event.candidate.sdpMLineIndex,
                        id: event.candidate.sdpMid,
                        candidate: event.candidate.candidate
                    });
                }
            };

            pc1.onaddstream = function (ev) {
                console.log('stream',ev);
                attachMediaStream(vidRemote[0], ev.stream);
            }
            pc1.addStream(localStream);

            if (config.guest) {
                webRTC.createOffer();
            }
            //setTimeout(function () {
            //}, 2000);
        }
    };
    webRTC.init();
});
