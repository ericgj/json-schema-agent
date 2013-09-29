var assert = require('timoxley-assert')
  , Ref = require('json-schema-agent/ref')
  , Agent = require('json-schema-agent')

fixtures = {};

Agent.service(DummyClient);

///////////////////////////////////

describe('json-schema-agent references', function(){
  describe('parse simple', function(){
    
    beforeEach( function(){
      this.subject = new Ref().parse(fixtures.parse.one);
    })

    it('should parse', function(){ 
      console.log("subject one: %o", this.subject);
    })
    
    it('should store referents by canonicalized URI', function(){
      var act = this.subject.getReferent('http://my.site/myschema#');
      assert('#' == act);
      act = this.subject.getReferent('http://my.site/schema1');
      assert('#/definitions/schema1' == act);
    })

    it('should store referrers by path pointing to canonicalized URI', function(){
      var act = this.subject.getReferrer('#/definitions/schema2/items');
      assert('http://my.site/schema1' == act);
    })

  })

  describe('parse for inline dereferencing', function(){

    beforeEach( function(){
      this.subject = new Ref().parse(fixtures.parse.two);
    })

    it('should parse', function(){ 
      console.log("subject two: %o", this.subject);
    })

    it('should store referrers by path pointing to canonicalized URI', function(){
      var act = this.subject.getReferrer('#/not');
      assert('http://some.site/schema#inner' == act);
    })
 
  })

  describe('parse, no top-level id', function(){

    beforeEach( function(){
      this.subject = new Ref().parse(fixtures.parse.noid);
    })

    it('should parse', function(){ 
      console.log("subject noid: %o", this.subject);
    })

    it('should store referrers by path pointing to relative URI', function(){
      var act = this.subject.getReferrer('#/not');
      assert('#/definitions/schema2' == act);
      act = this.subject.getReferrer('#/definitions/schema2/items');
      assert('schema1' == act);
    })

  })

  describe('getId', function(){

    beforeEach( function(){
      this.subject = new Ref().parse(fixtures.parse.one)
    })

    it('should find by id', function(){
      var act = this.subject.getId("http://my.site/schema1")
      assert(act.type == 'integer');
    })

    it('should find root id', function(){
      var act = this.subject.getId("http://my.site/myschema#")
      console.log("getId: %o", act);
      assert(act.definitions);
    })

  })

  describe('getPath', function(){

    beforeEach( function(){
      this.subject = new Ref().parse(fixtures.deref.local)
    })

    it('should find by path', function(){
      var act = this.subject.getPath("#/definitions/string")
      console.log("getPath: %o", act);
      assert(act.type == 'string');
    })

    it('should find root path', function(){
      var act = this.subject.getPath('#')
      assert(act);
    })

  })

  describe('dereference paths, local', function(){

    beforeEach(function(){
      this.obj = JSON.parse(JSON.stringify(fixtures.deref.local));
      this.ref = new Ref().parse(this.obj);
      this.subject = this.ref.root();
    })

    it('should run without error', function(done){ 
      var ref = this.ref
      ref.dereference(function(err){
        console.log("ref: %o", ref);
        assert(!err);
        done();
      })
    })

    it('should dereference back-references', function(done){
      var ref = this.ref, subj = this.subject
      ref.dereference(function(){
        var act = subj.properties.back.type
        assert(act == 'string');
        act = subj.properties.self
        for (var k in this.obj){
          if (k !== 'id') assert(act[k] == this.obj[k]);
        }
        done();
      })
    })

    it('should dereference forward-references', function(done){
      var ref = this.ref, subj = this.subject
      ref.dereference( function(){
        var act = subj.definitions.forward.type
        assert(act == 'string');
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
      var ref = new Ref(new Agent).parse(obj);
      ref.dereference( function(err){
        console.log('remote deref: %o', obj);
        assert(!err);
        var exp = fixtures.deref.remote.schema1
          , act = obj.definitions.schema1
        assert(exp); 
        assert(act);
        for (var k in exp) {
          if (k !== 'id') assert(act[k] == exp[k]);
        }
        done();
      });
    })

    it('should dereference given fragment URI', function(done){
      setupClient([fixtures.links.remote.fragment, 
                   fixtures.responses.remote.fragment]);
      var obj = JSON.parse(JSON.stringify(fixtures.deref.remote.two));
      var ref = new Ref(new Agent).parse(obj);
      ref.dereference( function(err){
        console.log('remote deref: %o', obj);
        console.log('remote ref: %o', ref);
        assert(!err);
        var exp = fixtures.deref.remote.fragment.definitions.fragment
          , act = obj.definitions.schema2
        assert(exp);
        assert(act);
        for (var k in exp){
          if (k !== 'id') assert(act[k] == exp[k]);
        }
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

fixtures.parse = {}
fixtures.parse.one = {
  id: "http://my.site/myschema#",
  definitions: {
    schema1: {
      id: "schema1",
      type: "integer"
    },
    schema2: {
      type: "array",
      items: { "$ref": "schema1" }
    }
  }
}


fixtures.parse.two = {
  id: "http://some.site/schema#",
  not: { "$ref": "#inner" },
  definitions: {
    schema1: {
      id: "#inner",
      type: "boolean"
    }
  }
}

fixtures.parse.noid = {
  definitions: {
    schema1: {
      id: "schema1",
      type: "integer"
    },
    schema2: {
      type: "array",
      items: { "$ref": "schema1" }
    }
  },
  not: { "$ref": "#/definitions/schema2" }
}


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

