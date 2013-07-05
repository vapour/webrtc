define(function (require, exports, module) {
    require('./adapter');

    var btnStart, btnCall, btnHangUp, vidLocal, vidRemote;
    var localStream, pc1, pc2, sdpConstraints, servers;
    var webRTC = {
        init: function () {
            btnStart = $('#btnStart');
            btnCall = $('#btnCall');
            btnHangUp = $('#btnHangUp');

            sdpConstraints = {
                mandatory: {
                    OfferToReceiveAudio: true,
                    OfferToReceiveVideo: true
                }
            };

            vidLocal = $('#vidLocal');
            vidRemote = $('#vidRemote');
            
            btnStart.attr('disabled', false);
            btnCall.attr('disabled', true);
            btnHangUp.attr('disabled', true);

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
        },
        hangUp: function () {
            pc1.close(); 
            pc2.close();
            pc1 = null;
            pc2 = null;
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
            }, function () {});
        },
        call: function () {
            btnCall.attr('disabled', true);
            btnHangUp.attr('disabled', false);

            pc1 = new RTCPeerConnection(servers);
            pc1.onicecandidate = function (ev) {
                if (ev.candidate) {
                    pc2.addIceCandidate(new RTCIceCandidate(ev.candidate));
                    console.log('local ice candidate:' + ev.candidate);
                }
            };

            pc2 = new RTCPeerConnection(servers);
            pc2.onicecandidate = function (ev) {
                if (ev.candidate) {
                    if (ev.candidate) {
                        pc1.addIceCandidate(new RTCIceCandidate(ev.candidate));
                        console.log('remote ice candidate:' + ev.candidate);
                    }
                }
            };
            pc2.onaddstream = function (e) {
                attachMediaStream(vidRemote[0], e.stream);
                console.log("Received remote stream");
            };

            pc1.addStream(localStream);
            console.log("Adding Local Stream to peer connection");

            pc1.createOffer(function (desc) {
                pc1.setLocalDescription(desc);
                console.log("Offer from pc1 \n" + desc.sdp);
                pc2.setRemoteDescription(desc);
                // Since the "remote" side has no media stream we need
                // to pass in the right constraints in order for it to
                // accept the incoming offer of audio and video.
                pc2.createAnswer(function (desc) {
                    pc2.setLocalDescription(desc);
                    console.log("Answer from pc2 \n" + desc.sdp);
                    pc1.setRemoteDescription(desc);   
                }, null, sdpConstraints);
            });
        }
    };
    webRTC.init();
});
