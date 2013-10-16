'use strict';

var isBrowser = require('is-browser')
  , assert = require('assert')
  , Agent = isBrowser ? require('json-schema-agent') : require('json-schema-agent-component')
  , core = isBrowser ? require('json-schema-core') : require('json-schema-core-component') 
  , Schema = core.Schema

var fixtures = {};

Agent.service(DummyClient);

var agent = new Agent();

///////////////////////////////////

describe('json-schema-agent dereferencing', function(){

  describe('dereference paths, local', function(){

    beforeEach(function(){
      this.subject = JSON.parse(JSON.stringify(fixtures.deref.local));
    })

    it('should run without error', function(done){ 
      var subj = this.subject
      agent.dereference(subj, function(err,schema){
        console.log("local: %o", schema);
        assert(!err);
        done();
      })
    })

    it('should dereference back-references', function(done){
      var subj = this.subject
      agent.dereference(subj, function(err,schema){
        var act = schema.getPath('properties/back');
        assert(act.property('type') == 'string');
        act = schema.getPath('properties/self')
        assert(schema === act);
        done();
      })
    })

    it('should dereference forward-references', function(done){
      var subj = this.subject
      agent.dereference(subj, function(err,schema){
        var act = schema.getPath('definitions/forward')
        assert(act.property('type') == 'string');
        done();
      })
    })

  })


  describe('dereference paths, remote', function(){

    function setupClient(pair){
      DummyClient.expect( pair[0], 
                          undefined,
                          pair[1]
                        );
    }

    function resetClient(){ DummyClient.reset(); }

    beforeEach(resetClient);
   
    it('should dereference', function(done){
      setupClient([fixtures.links.remote.schema1, 
                   fixtures.responses.remote.schema1]);
      var subj = JSON.parse(JSON.stringify(fixtures.deref.remote.one));
      agent.dereference(subj, function(err,schema){
        console.log('remote deref: %o', schema);
        assert(!err);
        var exp = fixtures.deref.remote.schema1
          , act = schema.getPath('definitions/schema1');
        assert(exp); 
        assert(act);
        assert('array' == act.property('type'));
        done();
      });
    })

    it('should dereference given fragment URI', function(done){
      setupClient([fixtures.links.remote.fragment, 
                   fixtures.responses.remote.fragment]);
      var subj = JSON.parse(JSON.stringify(fixtures.deref.remote.two));
      agent.dereference(subj, function(err,schema){
        console.log('remote deref fragment: %o', schema);
        assert(!err);
        var exp = fixtures.deref.remote.fragment.definitions.fragment
          , act = schema.getPath('definitions/schema2');
        assert(exp);
        assert(act);
        assert('integer' == act.property('type'));
        done();
      });
    })
    

  })


})

///////////////////////////////////

function DummyClient(){
  if (!(this instanceof DummyClient)) return new DummyClient;
  return this;
}
DummyClient.expect = function(href,err,res){
  (this._expects[href] = this._expects[href] || []).push([err,res]);
}
DummyClient.reset = function(){
  this._expects = {};
}
DummyClient.reset();

DummyClient.prototype.set = function(key,val){ } // eat it, no request header testing done here

DummyClient.prototype.get = function(href,params,fn){
  console.log("GET " + href);
  if ('function' == typeof params){
    fn = params; params = undefined;
  }
  var responses = DummyClient._expects[href]
    , res = responses && responses.shift()
  if (!res){ 
    var err = new Error('No expected call to ' + href)
    console.log(err.toString());
    fn(err); return;
  }
  fn(res[0],res[1]);
}

///////////////////////////////////

fixtures.deref = {};
fixtures.deref.local = {
  definitions: {
    forward: { '$ref': '#/definitions/string'},
    string: { type: 'string' }
  },
  properties: {
    back: {'$ref': '#/definitions/string'},
    self: {'$ref': '#'}
  }
}


fixtures.deref.remote = {}

fixtures.deref.remote.one = {
  id: "http://my.site/myschema#",
  definitions: {
    schema1: {
      "$ref": "schema1"
    }
  }
}

fixtures.deref.remote.two = {
  id: "http://my.site/myschema#",
  definitions: {
    schema2: {
      "$ref": "schema2#fragment1"
    }
  }
}

fixtures.deref.remote.schema1 = {
  type: "array",
  items: {
    type: "string"
  }
}

fixtures.deref.remote.fragment = {
  id: "http://my.site/schema2#",
  definitions: {
    fragment: {
      id: "#fragment1",
      type: "integer"
    }
  }
}

// DummyServer fixture setup

fixtures.links = {}
fixtures.links.remote = {}
fixtures.links.remote.schema1 = "http://my.site/schema1"
fixtures.links.remote.fragment = "http://my.site/schema2"

fixtures.responses = {}
fixtures.responses.remote = {}
fixtures.responses.remote.schema1 = {
  header: {
    "content-type": "application/schema+json" 
  },
  status: 200,
  body: fixtures.deref.remote.schema1
}

fixtures.responses.remote.fragment = {
  header: {
    "content-type": "application/schema+json" 
  },
  status: 200,
  body: fixtures.deref.remote.fragment
}

