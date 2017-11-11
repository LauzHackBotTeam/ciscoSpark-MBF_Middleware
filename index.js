const restify = require('restify');
const rp = require('request-promise')
const mongodb = require('mongodb');

const CISCOSPARK_URL = 'https://api.ciscospark.com/v1/'
const DIRECTLINE_URL = 'https://directline.botframework.com/v3/directline/'

const CISCO_ACCESS_TOKEN = process.env.CISCO_ACCESS_TOKEN;
const MONGODB_URL = process.env.MONGODB_URL;
const DIRECTLINE_SECRET = process.env.DIRECTLINE_SECRET;

const server = restify.createServer({
//   name: 'myapp',
//   version: '1.0.0'
});

let MongoClient = require('mongodb').MongoClient;
let dbConnector;
let roomsConnector;

MongoClient.connect(MONGODB_URL, function(err, db) {
  // Use the admin database for the operation
  dbConnector = db;

  // List all the available databases
  // db.listDatabases(function(err, dbs) {
  //   console.log("Available DBs");
  //   console.log(dbs);
  // });

  // dbConnector.listCollections().toArray().then(function(items) {
  //   console.log(items);
  // });

  roomsConnector = dbConnector.collection('rooms');
  // Ensure the collection was created
  // collection.insertOne({id:"123453245"});
});

server.use(restify.plugins.acceptParser(server.acceptable));
server.use(restify.plugins.queryParser());
server.use(restify.plugins.bodyParser());

server.listen(8080, () => {
  console.log('%s listening at %s', server.name, server.url);
});

server.post('/events', (req, res, next) => {
  // console.log("POST");
  // console.log(req.body);
  res.status(200);
  res.send();

  // get message content
  if(req.body && req.body.data && req.body.data.personEmail && req.body.data.personEmail == "helpmeimsick@sparkbot.io") return next();
  getMessage(req.body.data.id, (text) => {
    getConversationId(req.body.data.roomId, (conversationId) => {
      console.log(conversationId);
      sendActivityToDirectLine(conversationId, text, req.body.data.personEmail);
    });
  });
  next();
});

server.post('/reply', (req, res, next) => {
  // console.log("POST");
  // console.log(req.body);
  res.status(200);
  res.send();
  sendToSpark(req.body);
  
  next();
});

let getMessage = (id, cb) => {
  rp({
    method: 'GET',
    url: CISCOSPARK_URL + 'messages/' + id,
    headers: {
      'Content-type': 'application/json',
      'Authorization': `Bearer ${CISCO_ACCESS_TOKEN}`
    },
    json: true
  })
    .then((resp) => {
      console.log(resp);
      cb(resp.text);
    })
    .catch((err) => {
      console.log("there was an error");
      console.log(err);
    })
}


let getConversationId = (room, cb) => {
  roomsConnector.findOne({room}, (err, doc) => {
    if(err) return console.log(err);
    if(doc) return cb(doc.conversationId);
    
    // There is no conversation-room
    rp({
      method: 'POST',
      url: DIRECTLINE_URL + 'conversations',
      headers: {
        Authorization: `Bearer ${DIRECTLINE_SECRET}`
      },
      json: true
    })
      .then((resp) => {
        let conversationId = resp.conversationId;
        roomsConnector.insertOne({room, conversationId}, (err, doc) => {
          if(err) console.log(err);
          cb(conversationId);
        })
      })
      .catch((err) => {
        console.log(err)
      });
    // roomsConnector.insertOne({room:"123453245", conversationId: "dsassfds"});
  })
}


let sendActivityToDirectLine = (conversationId, text, userid) => {
  rp({
    method: 'POST',
    url: DIRECTLINE_URL + 'conversations/' + conversationId + '/activities',
    headers: {
      Authorization: `Bearer ${DIRECTLINE_SECRET}`,
      "Content-Type": "application/json"
    },
    body: {
      "type": "message",
      "from": {
          "id": userid
      },
      text
    },
    json: true
  })
    .then((resp) => {
      console.log(resp);
    })
    .catch((err) => {
      console.log(err);
    })
}


let sendToSpark = (info) => {
  console.log(info);

  let conversationId = info.address.conversation.id;
  roomsConnector.findOne({conversationId}, (err, doc) => {
    if(err) return console.log(err);
    if(!doc.room) return console.log(doc);
    rp({
      method: 'POST',
      url: CISCOSPARK_URL + 'messages',
      headers: {
        'Content-type': 'application/json',
        'Authorization': `Bearer ${CISCO_ACCESS_TOKEN}`
      },
      body: {
        roomId: doc.room,
        // toPersonEmail: info.address.user.id,
        text: info.message
      },
      json: true
    })
      .then((resp) => {
        console.log(resp);
      })
      .catch((err) => {
        console.log(err);
      })
  })
}