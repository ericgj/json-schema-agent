var assert = require('timoxley-assert')
  , Ref = require('json-schema-agent/ref')

fixtures = {};

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
      this.subject = new Ref().parse(fixtures.deref.paths)
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
      var obj = JSON.parse(JSON.stringify(fixtures.deref.paths));
      this.ref = new Ref().parse(obj);
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
        assert(act === subj);
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

})

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
fixtures.deref.paths = {
  definitions: {
    forward: { '$ref': '#/definitions/string'},
    string: { type: 'string' }
  },
  properties: {
    back: {'$ref': '#/definitions/string'},
    self: {'$ref': '#'}
  }
}


