'use strict';

var core = require('json-schema-core')
  , hyper = require('json-schema-hyper')
  , uri = require('./uri')
  , canonicalURI = uri.canonicalURI
  , baseURI = uri.baseURI
  , fragmentURI = uri.fragmentURI
  
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
Cache.prototype.set = function(uri,doc){ this._cache[uri] = doc; }



Agent.prototype.base = function(base){
  if (arguments.length > 0) { this._base = base; }
  else { return this._base }
}

Agent.prototype.fetch = function( link, params, fn ){
  // parameter normalization
  if (arguments.length == 2){
    fn = params; params = {};
  }
  if ("string" == typeof link) link = {href: link};
  
  // input schema validation
  if (params && link.schema && link.schema.validate){
    var check = link.schema.validate(params);
    if (!check.valid){
      var err = buildError(new Error(), check);
      fn(err); return;
    }
  }
  
  var request = Agent.Service();
  
  // build request
  var uri     = canonicalURI(this.base(),link.href)
    , baseuri = baseURI(uri)
    , accept  = link.mediaType
  
  if (accept) request.setHeader('Accept', accept);
  // todo set request body parser?
  
  // send request, wrapping response
  var self = this;
  request.get(baseuri, params, function(err,res){ 
    if (err){ fn(err); return; }  
    wrapFetch.call(self, link.targetSchema,res,fn); 
  });
  
}

// private

function wrapFetch(targetSchema,res,fn){
  var agent = this;
  var schemaUri = getSchemaURI(res);
  if (!schemaUri){
    var corr = new Correlation(undefined,res.body);
    fn(undefined,corr); return;
  }
  
  schemaUri = canonicalURI(agent.base(),schemaUri);
  var baseSchemaUri = baseURI(schemaUri)
    , fragment = fragmentURI(schemaUri)
    , baseDoc = agent._cache.get(baseSchemaUri)
    , instance = res.body
  
  if (baseDoc){
    fn.apply(
      undefined,
      buildCorrelate(fragment,baseDoc.root,instance,targetSchema)
    );
    return;
  } else {
    // cache miss
    agent.fetch(schemaUri, function(schemaerr,schemacorr){
      if (schemaerr) {
        fn(schemaerr); return;  // not sure this is right
      }
      baseDoc = new Document().parse(schemacorr.instance);
      baseDoc.dereference();  // todo if/when this is async, the rest of this block has to be done as callback
      agent._cache.set(baseSchemaUri,baseDoc);
      fn.apply( 
        undefined,
        buildCorrelate(fragment,baseDoc.root,instance,targetSchema)
      );
      return;
    })
  }
}

function buildCorrelate(fragment,schema,instance,targetSchema){
  var corr = schema.bind(instance);
  if (targetSchema && targetSchema.validate){
    var check = targetSchema.validate(instance);
    if (!check.valid){
      var err = buildError(new Error(),check);
      return [err,corr];
    }
  }
  
  // todo wrap error if fragment not found
  if (fragment) corr = corr.$(fragment);
  
  return [undefined, corr];

}


function buildError(err,data){
  data.message = err.message;
  err.data = data;
  return err;
}


function getSchemaURI(res){
  return getContentTypeProfile(res) ||
         getDescribedByLink(res);
}

function getContentTypeProfile(res){
  if (res.profile) {
    return res.profile;  // content-type params automatically set
  } else {
    // manual parse content-type params
    var ct = res.header['content-type'] || res.header['Content-Type'];
    return params(ct).profile;
  }
}

function getDescribedByLink(res){
  var link = res.header['link'] || res.header['Link'];
  // TODO PITA parsing of Link header
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
