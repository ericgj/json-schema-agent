
/**
 * Module dependencies.
 */

var express = require('express')
  , app = express();

// middleware

app.use(express.logger('dev'));
app.use(express.bodyParser());

// faux db

var db = { groups: [], users: [], memberships: {} };
var fixtures = { groups: {}, users: {}, memberships: {} }

// routes

// service route to initialize dbase
app.post('/fixtures', function(req, res){
  var type = req.param('type','default')
  initdb(type);
  res.send(200);
})

/**
 * DELETE everything
 */

app.del('/', function(req, res){
  initdb();
  res.send(200);
});


// top-level navigation
app.get('/', function(req, res){
  var data = {
    users: 'users',
    groups: 'groups'
  }
  res.setHeader('Link', '</schemas/nav.json>;rel="describedBy"');
  res.send(data);
});

app.get('/users', function(req, res){
  var data = { users: db.users }
  res.setHeader('Content-Type', 'application/json;profile=/schemas/users.json');
  res.send(data);
});

app.get('/users/:id', function(req,res){
  var id = req.params.id
    , data = db.users[id]
  if (data){ res.send(data) }
  else { res.send(404) }
})

app.get('/missing-ref', function(req, res){
  var data = {}
  res.setHeader('Link', '</schemas/missing-ref.json>;rel="describedBy"');
  res.send(data);
})

app.get('/missing-ref-external', function(req, res){
  var data = {}
  res.setHeader('Link', '</schemas/missing-ref-external.json>;rel="describedBy"');
  res.send(data);
})

app.get('/cyclical-ref', function(req, res){
  var data = {}
  res.setHeader('Link', '</schemas/cyclical-ref-a.json>;rel="describedBy"');
  res.send(data);
})

app.get('/missing-schema', function(req, res){
  var data = {}
  res.setHeader('Link', '</schemas/foo.json>;rel="describedBy",</schemas/users.json>;rel="describedBy"');
  res.send(data);
})

// note static dirs handled AFTER routes above

app.use(express.static(__dirname));
app.use(express.static(__dirname + '/..'));
app.use(express.static(__dirname + '/schemas'));

app.listen(3000);
console.log('test server listening on port 3000');

// private

function initdb(type){
  db.groups      = fixtures.groups[type] || [];
  db.users       = fixtures.users[type] || [];
  db.memberships = fixtures.memberships[type] || {};
}


// fixtures

fixtures.users.default = [
  { id: 0, name: "bjorn borg", email: "bj@tennis.com" },
  { id: 1, name: "john mcenroe", email: "jmce@faker.com" },
  { id: 2, name: "venus williams", email: "venus@rackets.com" }
]

