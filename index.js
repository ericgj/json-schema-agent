var core = require('json-schema-core')
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
    fn = params; params = undefined;
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
  request.get(baseuri, function(err,res){ 
    if (err){ fn(err); return; }  
    wrapFetch.call(this, link.targetSchema,res,fn); 
  });
  
}

// private

function wrapFetch(targetSchema,res,fn){
  var agent = this;
  var schemaUri = parseSchemaURI(res);
  if (!schemaUri){
    var corr = new Correlation(undefined,res.body);
    fn(undefined,corr); return;
  }
  
  schemaUri = canonicalURI(agent.base(),schemaUri);
  var baseSchemaUri = baseURI(schemaUri)
    , fragment = fragmentURI(schemaUri)
    , baseDoc = agent.cache.get(baseSchemaUri)
    , instance = res.body
  
  if (baseDoc){
    fn.apply(
      buildCorrelate.call(agent,baseSchemaUri,fragment,baseDoc.root,instance,targetSchema);
    );
    return;
  } else {
    // cache miss
    this.fetch(schemaUri, function(schemaerr,schemacorr){
      if (schemaerr) {
        fn(schemaerr); return;  // not sure this is right
      }
      baseDoc = new Document().parse(schemacorr.instance);
      baseDoc.dereference();  // todo if/when this is async, the rest of this block has to be done as callback
      this.cache.set(baseSchemaUri,baseDoc);
      fn.apply(
        buildCorrelate.call(agent,baseSchemaUri,fragment,baseDoc.root,instance,targetSchema);
      );
      return;
    })
  }
}

function buildCorrelate(uri,fragment,schema,instance,targetSchema){
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


// TODO

function buildError(err,data){

}


function parseSchemaURI(res){

}


