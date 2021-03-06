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

  it('should fetch and dereference schema with multiple reference levels', function(done){
    var agent = new Agent();
    if (!isBrowser) agent.base(ORIGIN);
    agent.getSchema('/schemas/json-patch.json', function(err,schema){
      console.log('schema: %o', schema);
      assert(!err);
      
      // simple reference

      var referrer = schema.$('#/items/allOf/0/properties/path')
        , referred = schema.$('#/definitions/jsonPointer')
      assert(referrer); assert(referred);
      assert(referrer === referred);

      // reference to schema array with references

      var referrer = schema.$('#/items/allOf/1/oneOf/0')
        , referred = schema.$('#/definitions/oneOperation/oneOf/0')
      assert(referrer); assert(referred);
      assert(referrer === referred);
      
      done();
    })
  })

  it('should throw error when fragment reference doesnt exist in schema', function(done){
    var agent = new Agent();
    if (!isBrowser) agent.base(ORIGIN);
    agent.get('/missing-ref', function(err,corr){
      console.log('error fragment ref no exist: %o', err);
      assert(err);
      done();
    });
  })

  it('should throw error when external schema reference not found', function(done){
    var agent = new Agent();
    if (!isBrowser) agent.base(ORIGIN);
    agent.get('/missing-ref-external', function(err,corr){
      console.log('error external ref no exist: %o', err);
      assert(err);
      done();
    });
  })

  it('should throw error when cyclical schema reference found', function(done){
    var agent = new Agent();
    if (!isBrowser) agent.base(ORIGIN);
    agent.get('/cyclical-ref', function(err,corr){
      console.log('error cyclical ref: %o', err);
      assert(err);
      done();
    });
  })

  // note I'm not sure about this behavior
  // as it ends up firing the callback twice
  
  it('should throw error when schema missing, but continue correlating', function(done){
    var agent = new Agent();
    if (!isBrowser) agent.base(ORIGIN);
    var count = 0, errcount = 0;
    agent.get('/missing-schema', function(err,corr){
      count++;
      if (err) {
        console.log('error missing schema: %o', err);
        errcount++;
      }
      if (corr) {
        console.log('correlation missing schema: %o', corr);
      }
      if (count == 2 && errcount == 1) done();
    });
  })

})

