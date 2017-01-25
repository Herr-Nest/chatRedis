var app = require('express')(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server),
    redis = require('redis');

var publisher = redis.createClient(6379,'localhost');

// Chargement de la page index.html
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

io.sockets.on('connection', function (socket, pseudo) {
  var subscriber = redis.createClient(6379,'localhost');
  subscriber.subscribe('general');
  subscriber.subscribe('connected');
    // Dès qu'on nous donne un pseudo, on le stocke en variable de session et on informe les autres personnes
    socket.on('nouveau_client', function(pseudo) {

        publisher.sismember('connected', pseudo,function(err,reply){
          if(err) throw err;
          if(reply==1){
            socket.emit('pseudoExists');
          }else {
            socket.pseudo = pseudo
            publisher.sadd('connected',socket.pseudo)
            publisher.publish('connected', pseudo);
          }
        });


    });

    // Dès qu'on reçoit un message, on récupère le pseudo de son auteur et on le transmet aux autres personnes
    socket.on('message', function (message) {
        publisher.publish('general',JSON.stringify({pseudo:socket.pseudo,message:message}));
        //socket.broadcast.emit('message', {pseudo: socket.pseudo, message: message});
    });

    subscriber.on('message',function(channel,message){
      if(channel=='general'){
        socket.emit('message',message);
      }else if (channel=='connected') {
        publisher.smembers("connected",function(err,result){
            var users = JSON.stringify(result);
            socket.emit('listePseudo',users);
        });

      }
    })

  /*  subscriber.on('connected',function(channel,message){

      if(message!=socket.pseudo){
        socket.emit('listePseudo',publisher.smembers('connected',function(err,result){
          console.log(result);
        }));
      }
    })*/

    socket.on('disconnect', function () {
      subscriber.unsubscribe();
      publisher.publish('connected', socket.pseudo +" s'est déconnecté");
      publisher.sismember('connected',socket.pseudo,function(err,reply){
        if(err) throw err;
        if(reply==1){
          publisher.srem('connected',socket.pseudo);
        }
      });
      socket.leave();
  });
});

server.listen(8080);
