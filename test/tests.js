var assert = require('timoxley-assert')
  , Agent = require('json-schema-agent')

fixtures = {};

Agent.service(DummyClient);

///////////////////////////////////

describe('json-schema-agent', function(){
  describe('fetch', function(){
    
    function setupClient(instancePair,schemaPair){
      DummyClient.reset();
      DummyClient.expect( fixtures.links.instances[instancePair[0]].href, 
                          undefined,
                          fixtures.responses.instances[instancePair[1]]
                        );
      DummyClient.expect( fixtures.links.schemas[schemaPair[0]].href,
                          undefined,
                          fixtures.responses.schemas[schemaPair[1]]
                        );
    }

    it('should fetch correlation based on Content-Type header', function(){ 
      setupClient(['simple','contentType'],['contact','contact']);
      var agent = new Agent();
      agent.fetch( fixtures.links.instances.simple, function(err,corr){
        console.log('cache: %o', agent._cache);
        console.log('error: %o', err);
        console.log('correlation: %o', corr);
        assert(!err);
        assert(corr);
        assert(corr.schema.$('#/properties/email'));
        assert.deepEqual(corr.instance, fixtures.instances.simple);
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


DummyClient.prototype.get = function(href,params,fn){
  console.log("GET " + href);
  var responses = DummyClient._expects[href]
    , res = responses && responses.shift()
  if (!res){ 
    var err = new Error('No expected call to ' + href)
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

fixtures.responses.instances.contentType = {
  header: {
    "content-type": "application/vnd.contact+json; profile=" + fixtures.links.schemas.contact.href 
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



