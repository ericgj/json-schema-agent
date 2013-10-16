'use strict';

var isBrowser = require('is-browser')
  , assert = require('assert')
  , Request = require('superagent')
  , Agent = isBrowser ? require('json-schema-agent') : require('json-schema-agent-component')

function Client(){ return Request; }

Agent.service(Client);

var ORIGIN = "http://localhost:3000"

describe('json-schema-agent: functional tests', function(){

  beforeEach( function(done){
    Client().post(ORIGIN + '/fixtures?type=default', function(){ done(); })
  })

  it('should correlate root path', function(done){
    var agent = new Agent();
    if (!isBrowser) agent.base(ORIGIN);
    agent.get('/', function(err,corr){
      console.log('correlation root path: %o', corr);
      assert(!err);
      assert(corr.schema);
      assert(corr.instance);
      assert(corr.rel('groups'));
      assert(corr.rel('users'));
      done();
    })
  })

  it('should correlate user path, and follow link to user', function(done){
    var agent = new Agent();
    if (!isBrowser) agent.base(ORIGIN);
    agent.get('/', function(err,nav){
      assert(nav.rel('users'));
      agent.follow(nav.rel('users'), function(err2,users){
        console.log('correlation users path: %o', users);
        assert(!err2);
        assert(users);
        var user = users.getRoot().get('1');
        assert(user);
        agent.follow(user.rel('self'), function(err3,u){
          console.log('correlation user path: %o', u);
          assert(!err3);
          assert(u);
          done();
        })
      })
    })
  })
  
  it('http error should be caught', function(done){
    var agent = new Agent();
    if (!isBrowser) agent.base(ORIGIN);
    agent.get('/', function(err,nav){
      agent.follow(nav.rel('users'), function(err2,users){
        var user = users.getRoot().get('1');
        agent.follow(user.rel('bad'), function(err3,u){
          console.log('http error: %o', err3);
          assert(err3);
          done();
        })
      })
    })
  })



})
