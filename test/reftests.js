var assert = require('timoxley-assert')
  , deref = require('json-schema-agent/deref')
  , Agent = require('json-schema-agent')
  , core = require('json-schema-core')
  , Schema = core.Schema

fixtures = {};

Agent.service(DummyClient);

var agent = new Agent();

///////////////////////////////////

describe('json-schema-agent dereferencing', function(){

  describe('dereference paths, local', function(){

    beforeEach(function(){
      var obj = JSON.parse(JSON.stringify(fixtures.deref.local));
      this.subject = new Schema().parse(obj)
    })

    it('should run without error', function(done){ 
      var subj = this.subject
      deref( agent, subj, function(err){
        console.log("local: %o", subj);
        assert(!err);
        done();
      })
    })

    it('should dereference back-references', function(done){
      var subj = this.subject
      deref( agent, subj, function(){
        var act = subj.getPath('properties/back');
        assert(act.property('type') == 'string');
        act = subj.getPath('properties/self')
        assert(subj === act);
        done();
      })
    })

    it('should dereference forward-references', function(done){
      var subj = this.subject
      deref( agent, subj, function(){
        var act = subj.getPath('definitions/forward')
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
      var obj = JSON.parse(JSON.stringify(fixtures.deref.remote.one));
      var schema = new Schema().parse(obj);
      deref( agent, schema, function(err){
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
      var obj = JSON.parse(JSON.stringify(fixtures.deref.remote.two));
      var schema = new Schema().parse(obj);
      deref( agent, schema, function(err){
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

