
importScripts("pool.js");var Slave=function(){this.request_pending=false;};Slave.prototype.postMessage=function(msg){self.postMessage(msg);};Slave.prototype.postText=function(msg){this.postMessage({msg:msg});};Slave.prototype.postCommand=function(cmd,args){this.postMessage({cmd:cmd,args:args});};Slave.prototype.postError=function(msg,exc){this.postCommand(Pool.ERROR,{msg:msg,exception:exc});;};Slave.prototype.handleMessage=function(e){var data=e.data;if(data.cmd===undefined){this.postText("#"+this.id+" Unknown message: "+data);return;}
switch(data.cmd){case Pool.SET_ID:this.id=data.id;this.postText("Slave #"+this.id+" allocated");break;case Pool.NEW_TASK:this.requestTask();break;case Pool.START_TASK:this.doTask(data.id,data.task);break;case Pool.NO_TASK:this.noTask();break;case Pool.KILL:this.postCommand(Pool.WORKER_CLOSED);self.close();break;default:this.postText("#"+this.id+" Unknown command: "+data.cmd);}};Slave.prototype.requestTask=function(){if(!this.request_pending){this.request_pending=true;this.postCommand(Pool.REQUEST_TASK);}};Slave.prototype.setBusy=function(busy){this.postCommand(busy?Pool.BUSY:Pool.IDLE);if(!busy){this.requestTask();}};Slave.prototype.doTask=function(id,task){this.request_pending=false;this.postText("#"+this.id+" working on task "+id);var script=task.script;if(script){try{importScripts(script);}catch(exc){this.postError("Error importing script: "+script,exc);}}
var funcname=task.func;if(!funcname){this.postError("No function specified for worker");}else{var func=self[funcname];if(!func){this.postError("Function not found: "+funcname);}else{this.setBusy(true);try{var res=func.call(null,task.args);this.postMessage({cmd:Pool.TASK_RESULT,id:id,result:res});}catch(exc){this.postError("Error running: "+funcname+" from "+script+": ",exc);}
this.setBusy(false);}}
this.requestTask();};Slave.prototype.noTask=function(){this.request_pending=false;};var slave=new Slave();self.addEventListener('message',function(e){slave.handleMessage(e);},false);