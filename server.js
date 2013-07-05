var express = require('express');
var socket = require('socket.io');
var app = express();

app.configure(function() {
    app.set('views', __dirname + '/views');
    app.set('view engine', 'ejs');
    app.use(express.static(__dirname + '/public'));
    app.use(express.bodyParser());
});


var io = socket.listen(app.listen(8080));
var clients = [];
io.sockets.on('connection', function (socket) {
    var room, guest;
    //clients.push(socket); 
    //socket.emit('message', {message: 'welcome to the chat'});
    socket.on('send', function (data) {
        console.log('vapour', data);

        switch (data.type) {
            /**
             * When a user is invited
             * join the room
             */
            case 'INVITE':
                guest = true;
                room = data.value;
                console.log('vapour', data);
                clients[room].push(socket);
                break;
            /**
             * If you are the first user to connect
             * create room
             */
            case 'GETROOM':
                //room = Math.floor(Math.random() * 1000001).toString();
                room = 1234
                socket.emit('message', {'type' : 'GETROOM', 'value': room});
                clients.push(room);
                console.log('vapour', room);
                clients[room] = [];
                clients[room].push(socket);
            break;
            /**
             * When a user send a SDP message
             * broadcast to all users in the room
             */
            case "candidate" : 
            case "offer" : 
            case "answer" :
                console.log('vapour-sdp', data);
                clients[room].forEach(function(client) {
                    if(client != socket) {
                        client.emit('message', data);
                    }
                });
            break;
        }

        /*
        clients.forEach(function (obj) {
            if (obj != socket) {
                obj.emit('message', data);
            }
        });
        */
        //io.sockets.emit('message', data);
    });
});

app.get('/webrtc', function (req, res) {
    res.render('webrtc/index', {
        cache: false,
        locals: {
            t: +new Date(),
            title: 'webrtc'
        }
    });
});

