var assert = require('timoxley-assert')
  , Agent = require('json-schema-agent')

fixtures = {};

Agent.service(DummyClient);

///////////////////////////////////

describe('json-schema-agent', function(){
  describe('get', function(){
    
    function setupClient(instancePair,schemaPair){
      DummyClient.expect( fixtures.links.instances[instancePair[0]].href, 
                          undefined,
                          fixtures.responses.instances[instancePair[1]]
                        );
      DummyClient.expect( fixtures.links.schemas[schemaPair[0]].href,
                          undefined,
                          fixtures.responses.schemas[schemaPair[1]]
                        );
    }

    function resetClient(){ DummyClient.reset(); }

    beforeEach(function(){
      resetClient();
    })

    it('should get correlation based on Content-Type header', function(){ 
      setupClient(['simple','contentType'],['contact','contact']);
      var agent = new Agent();
      agent.get( fixtures.links.instances.simple, function(err,corr){
        console.log('cache: %o', agent._cache);
        console.log('error: %o', err);
        console.log('correlation: %o', corr);
        assert(!err);
        assert(corr);
        assert(corr.schema.$('#/properties/email'));
        assert.deepEqual(corr.instance, fixtures.instances.simple);
        assert('http://example.com/contacts/123' == corr.rel('self').get('href'));
      })
    })

    it('should get correlation from string link (href)', function(){ 
      setupClient(['simple','contentType'],['contact','contact']);
      var agent = new Agent();
      agent.get( fixtures.links.instances.string, function(err,corr){
        assert(!err);
        assert(corr.schema.$('#/properties/email'));
        assert.deepEqual(corr.instance, fixtures.instances.simple);
      })
    })

    it('should get correlation from relative link href', function(){ 
      setupClient(['simple','contentType'],['contact','contact']);
      var agent = new Agent();
      agent.base('http://example.com');
      agent.get( fixtures.links.instances.relative, function(err,corr){
        assert(!err);
        assert(corr.schema.$('#/properties/email'));
        assert.deepEqual(corr.instance, fixtures.instances.simple);
      })
    })

    it('should get correlation with relative schema link in response', function(){ 
      setupClient(['simple','relativeProfile'],['contact','contact']);
      var agent = new Agent();
      agent.base('http://example.com');
      agent.get( fixtures.links.instances.relative, function(err,corr){
        assert(!err);
        assert(corr.schema.$('#/properties/email'));
        assert.deepEqual(corr.instance, fixtures.instances.simple);
      })
    })

    it('should get correlation based on Link rel=describedBy header', function(){ 
      setupClient(['simple','link'],['contact','contact']);
      var agent = new Agent();
      agent.base('http://example.com');
      agent.get( fixtures.links.instances.simple, function(err,corr){
        assert(!err);
        assert(corr.schema.$('#/properties/email'));
        assert.deepEqual(corr.instance, fixtures.instances.simple);
      })
    })

    it('should get correlation from Link node object', function(){ 
      setupClient(['simple','contentType'],['contact','contact']);
      setupClient(['simple','contentType'],['contact','contact']);
      var agent = new Agent();
      agent.get( fixtures.links.instances.string, function(err,corr){
        var link = corr.rel('self');
        agent.get(link, function(err2,corr2){
          assert(!err);
          assert.deepEqual(corr.instance, corr2.instance);
        })
      })
    })

  })
})

//

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


// fixtures


fixtures.schemas = {};
fixtures.instances = {};
fixtures.links = {};
fixtures.links.schemas = {};
fixtures.links.instances = {};
fixtures.responses = {};
fixtures.responses.schemas = {};
fixtures.responses.instances = {};

fixtures.schemas.contact = {
  properties: {
    id: {}, name: {}, email: {}
  },
  required: ["id"],
  links: [
    { rel: "self",
      href: "http://example.com/contacts/{id}",
      mediaType: "application/vnd.contact+json"
    },
    { rel: "list",
      href: "http://example.com/contacts",
    }
  ]
}

fixtures.instances.simple = {
  id: 123, name: "Charlie Chaplin", email: "charlie@chaplin.com"
}

fixtures.links.instances.simple = { href: 'http://example.com/contacts/123' }
fixtures.links.instances.string = fixtures.links.instances.simple.href
fixtures.links.instances.relative = { href: '/contacts/123' }

fixtures.links.schemas.contact = { href: 'http://example.com/schemas/contact' }
fixtures.links.schemas.relative = { href: '/schemas/contact' }

fixtures.responses.instances.contentType = {
  header: {
    "content-type": "application/vnd.contact+json; profile=" + fixtures.links.schemas.contact.href 
  },
  type: "application/vnd.contact+json",
  status: 200,
  body: fixtures.instances.simple
}

fixtures.responses.instances.link = {
  header: {
    "Link": '<http://something.com/else>;rel=alternate , ' + "\n\r  " + 
            '<' + fixtures.links.schemas.contact.href + '> ; rel="describedBy",' + "\n\r  " +
            '<http://example.com/contacts/124>; rel="next"',
    "Content-Type": "application/vnd.contact+json"
  },
  type: "application/vnd.contact+json",
  status: 200,
  body: fixtures.instances.simple
}

fixtures.responses.instances.relativeProfile = {
  header: {
    "content-type": "application/vnd.contact+json; profile=" + fixtures.links.schemas.relative.href 
  },
  type: "application/vnd.contact+json",
  status: 200,
  body: fixtures.instances.simple
}


fixtures.responses.schemas.contact = {
  header: {
    "content-type": "application/schema+json"
  },
  status: 200,
  body: fixtures.schemas.contact
}



