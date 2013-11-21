'use strict';

var isBrowser = require('is-browser')
  , core = isBrowser ? require('json-schema-core') : require('json-schema-core-component')
  , hyper = isBrowser ? require('json-schema-hyper') : require('json-schema-hyper-component')
  , Uri = isBrowser ? require('json-schema-uri') : require('json-schema-uri-component')
  , getLinkHeaderHrefs = require('./linkheader')
  , deref = require('./deref')
  
var Correlation = core.Correlation
  , Schema = core.Schema
  , Document = core.Document


module.exports = Agent;

function Agent(cache){
  if (!(this instanceof Agent)) return new Agent(cache);
  this._cache = cache || new Cache;
  return this;
}

Schema.use(hyper);
Agent.Schema = Schema;

Agent.service = function(klass){ 
  if (arguments.length > 0) { this.Service = klass; }
  else { return this.Service; }
}
 
function Cache(){
  this._cache = {};
}
Cache.prototype.get = function(uri){ return this._cache[uri]; }
Cache.prototype.set = function(uri,obj){ this._cache[uri] = obj; }



Agent.prototype.base = function(base){
  if (arguments.length > 0) { this._base = base; }
  else { return this._base }
}

Agent.prototype.get = function(link,obj,fn){
  follow.call(this,'get',link,obj,fn);
}

Agent.prototype.head = function(link,obj,fn){
  follow.call(this,'head',link,obj,fn);
}

Agent.prototype.put = function(link,obj,fn){
  follow.call(this,'put',link,obj,fn);
}

Agent.prototype.post = function(link,obj,fn){
  follow.call(this,'post',link,obj,fn);
}

Agent.prototype.patch = function(link,obj,fn){
  follow.call(this,'patch',link,obj,fn);
}

Agent.prototype.del = function(link,fn){
  follow.call(this,'del',link,undefined,fn);
}

/*
 * Follow link based on method property
 */
Agent.prototype.follow = function(link,obj,fn){
  link = linkAttributes(link);
  var meth = (link.method || 'GET').toLowerCase();
  if (meth == 'delete') meth = 'del';

  var agent = this
  follow.call(this,meth,link,obj,fn);
}


/* 
 * Note public method, but rarely called from client code.  Yields a
 * schema object or fragment, dereferenced, from cache if present.
 * 
 * Called by `follow` callback to fetch schemas for instance URIs 
 * (`wrapCorrelate`), however it itself is a wrapper around `follow` in 
 * relation to _schema_ URIs.
 */
Agent.prototype.getSchema =
Agent.prototype.getCache = function(uri, fn){
  var agent = this
    , schemaUri = Uri(this.base()).join(uri)
    , base = schemaUri.base()
    , fragment = schemaUri.fragment()
    , schema = agent._cache.get(base)

  // cache hit
  if (schema){
    if (fragment) schema = schema.$(fragment);
    fn(undefined,schema);

  // cache miss
  } else {
    follow.call(agent, 'get', base, function(err,corr){
      if (err){ fn(err); return; }
      var obj = corr.instance;
      obj.id = obj.id || base;

      agent.dereference(obj,function(err,schema){
        if (err){ fn(err); return; }
        agent._cache.set(base,schema);
        if (fragment) schema = schema.$(fragment);
        fn(undefined,schema);
      });

    })
  }
}

/*
 * Dereference raw schema object, yielding built schema
 */
Agent.prototype.dereference = function(obj,fn){
  var schema = new Schema().parse(obj);
  deref(this,schema, function(err){
    fn(err,schema);
  });
}

// private 

/* 
 * Builds request from link, runs schema validation, and yields a _correlated 
 * instance_ (instance + schemas), first running targetSchema validation on it.
 * This is the JSON Hyper-Schema wrapper around the http request/response.
 */
function follow(meth,link,obj,fn){
  var agent = this;
   
   // parameter normalization
  if ('function' == typeof obj){
    fn = obj; obj = undefined;
  }
  link = linkAttributes(link);
 
  // input schema validation
  var err = validate(link.schema,obj);
  if (err){ fn(err); return; }
 
  // build request
  var request = Agent.Service();

  if (!request[meth]){
    var err = new Error("Unknown method: '" + meth + "'");
    fn(err); return;
  }

  var uri     = Uri(this.base()).join(link.href)
    , baseuri = uri.base()
    , fragment = uri.fragment()
    , accept  = link.mediaType
    , encType = link.encType

  encType = encType || (link.method == 'POST' ? 
                          'application/json' : 
                          undefined
                       );

  if (accept)  request.set('Accept', accept);
  if (encType) request.set('Content-Type', encType);
    
  var wrap = function(err,res){
    if (err){ fn(err); return; }
    if (res.error) { fn(res.error); return; }
    wrapCorrelate.call(agent,res,link.targetSchema,fn); 
  }

  // send request
  if (obj){
    request[meth](baseuri, obj, wrap);
  } else {
    request[meth](baseuri, wrap);
  }
 
}


function wrapCorrelate(res,targetSchema,fn){
  var agent = this
    , instance = res.body
  var schemaUris = getSchemaURIs(res);

  // no schemas specified, use blank
  if (!schemaUris || schemaUris.length == 0){
    var schema = new Schema().parse({});
    fn.apply(
      undefined,
      buildCorrelate(schema,instance,targetSchema)
    );
  
  // load each schema specified and build union schema
  } else {
    correlateSchemas.call(agent,schemaUris,instance,targetSchema,fn);
  }
}

function correlateSchemas(uris,instance,targetSchema,fn){
  var agent = this
    , schemas = []

  while (uris.length) {
    var uri = uris.shift()
    
    agent.getCache(uri, function(err,schema){
      if (err){ return; }  // ignore if error getting one schema, not quite right
      schemas.push(schema);

      // last schema, union and build correlation
      if (uris.length == 0){
        var union = schemas[0];
        if (schemas.length > 1) union = Schema.union(schemas);
        fn.apply(
          undefined,
          buildCorrelate(union,instance,targetSchema)
        );
      }

    });
  }
}

// utils

function linkAttributes(link){
  if ("string" == typeof link){
    return {href: link};
  } else if (link.nodeType && link.nodeType == "Link"){
    return link.attributes();
  }
  return link;
}

// note returns error if not valid, undefined otherwise
function validate(schema,obj){
  if (obj === undefined || !schema) return;
  var corr = schema.bind(obj)
  if (!corr.validate) return;
  var ret
  corr.once('error', function(err){ 
    ret = err; 
  });
  corr.validate();
  return ret;
}

function buildCorrelate(schema,instance,targetSchema){
  var corr = schema.bind(instance);
  var err = validate(targetSchema,instance);
  if (err) return [err,corr];
  return [undefined, corr];
}

function getSchemaURIs(res){
  var profile = getContentTypeProfile(res) 
  return profile ? [profile] 
                 : getDescribedByLinks(res);
}

function getContentTypeProfile(res){
  if (res.profile) {
    return res.profile;  // content-type params automatically set
  } else {
    // manual parse content-type params
    var ct = res.header['content-type'] || res.header['Content-Type'];
    if (ct) return params(ct).profile;
    return undefined;
  }
}

function getDescribedByLinks(res){
  var raw = res.header['link'] || res.header['Link'];
  if (!raw) return [];
  return getLinkHeaderHrefs(raw,'describedBy');
}


// taken from visionmedia/superagent

function params(str){
  return reduce(str.split(/ *; */), function(obj,str){
    var parts = str.split(/ *= */)
      , key = parts.shift()
      , val = parts.shift();

    if (key && val) obj[key] = val;
    return obj;
  }, {});
}

// inlined from RedVentures/reduce

function reduce(arr, fn, initial){  
  var idx = 0;
  var len = arr.length;
  var curr = arguments.length == 3
    ? initial
    : arr[idx++];

  while (idx < len) {
    curr = fn.call(null, curr, arr[idx], ++idx, arr);
  }
  
  return curr;
};
