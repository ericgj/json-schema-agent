'use strict';

var isBrowser = require('is-browser')
  , Emitter = isBrowser ? require('emitter') : require('emitter-component')

module.exports = Deref;

function Deref(agent,schema,fn){
  if (!(this instanceof Deref)) return new Deref(agent,schema,fn);
  this.agent = agent;
  if (schema) this.dereference(schema,fn);
  return this;
}

Deref.prototype = new Emitter();

Deref.prototype.dereference = function(schema,fn){

  schema = schema.root() || schema;
  var remotes = [];
  var self = this;

  if (fn){ 
    this.once('ready',fn); 
    this.once('error',fn);
  }

  schema.eachRef( function(uri,node,key){
    inlineDereference(schema,uri,node,key) ||
      remotes.push([uri,node,key]);
  })
  
  if (remotes.length == 0) {
    self.emit('ready');
  } else {
    while (remotes.length){
      var next = remotes.shift()
      next.push(remotes.length == 0);
      asyncDereference.apply(self,next);
    }
  }
}

// private 

function inlineDereference(schema,uri,node,key){
  var ref = schema.$(uri)  // try inline dereference by URI or JSON pointer 
  if (ref) node.set(key,ref);
  return (!!ref);
}

function asyncDereference(uri,node,key,last){
  var self = this, agent = this.agent
  agent.getCache(uri, function(err,refnode){
    if (err){
      self.emit('error', err);
      return;
    }

    node.set(key,refnode);
    if (last) self.emit('ready');

  })
}

