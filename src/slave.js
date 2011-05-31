//
// (c) 2011 Laurent Vaucher
// http://www.slowfrog.com
// This file is under Apache License V2.
//
importScripts("pool.js");

/** Class of all slaves. */
var Slave = function() {
  this.request_pending = false;
};

/** Low level message sending.
 *
 * @param msg full message to send
 */
Slave.prototype.postMessage = function(msg) {
  self.postMessage(msg);
};

/** Sends a text message.
 *
 * @param msg text message to send
 */
Slave.prototype.postText = function(msg) {
  this.postMessage({msg: msg});
};

/** Sends a command message.
 *
 * @param cmd command to send, taken from Pool constants
 * @param args command arguments
 */
Slave.prototype.postCommand = function(cmd, args) {
  this.postMessage({cmd: cmd, args: args});
};

/** Sends an error message to the pool.
 *
 * @param msg error text
 * @param exc exception
 */
Slave.prototype.postError = function(msg, exc) {
  this.postCommand(Pool.ERROR, {msg: msg, exception: exc});;
};

/** Message handling loop.
 *
 * @param e message received
 */
Slave.prototype.handleMessage = function(e) {
  var data = e.data;
  if (data.cmd === undefined) {
    this.postText("#" + this.id + " Unknown message: " + data);
    return;
  }
  switch (data.cmd) {
  case Pool.SET_ID:
    this.id = data.id;
    this.postText("Slave #" + this.id + " allocated");
    break;
    
  case Pool.NEW_TASK:
    this.requestTask();
    break;

  case Pool.START_TASK:
    this.doTask(data.id, data.task);
    break;

  case Pool.NO_TASK:
    this.noTask();
    break;

  case Pool.KILL:
    this.postCommand(Pool.WORKER_CLOSED);
    self.close();
    break;
    
  default:
    this.postText("#" + this.id + " Unknown command: " + data.cmd);
  }
};

/** Request a task from the pool. */
Slave.prototype.requestTask = function() {
  if (!this.request_pending) {
    this.request_pending = true;
    this.postCommand(Pool.REQUEST_TASK);
  }
};

/** Changes the busy state of this slave. Upon finishing a task, the slave will ask the pool for
 *  another one.
 *
 * @param busy <code>true</code> when starting a task, <code>false</code> when finishing a task
 */
Slave.prototype.setBusy = function(busy) {
  this.postCommand(busy ? Pool.BUSY : Pool.IDLE);
  if (!busy) {
    this.requestTask();
  }
};
  
/** Exectutes a task. That function will import the required script and call the required function
 *  on the passed arguments. Once the work is done, it will send the results to the pool.
 *
 * @param id task identifier
 * @param task task definition
 */
Slave.prototype.doTask = function(id, task) {
  this.request_pending = false;
  
  this.postText("#" + this.id + " working on task " + id);
  var script = task.script;
  if (script) {
    // Maybe we don't need scripts... but I doubt it!
    try {
      importScripts(script);
    } catch (exc) {
      this.postError("Error importing script: " + script, exc);
    }
  }
  var funcname = task.func;
  if (!funcname) {
    this.postError("No function specified for worker");
  } else {
    var func = self[funcname];
    if (!func) {
      this.postError("Function not found: " + funcname);
    } else {
      this.setBusy(true);
      try {
        var res = func.call(null, task.args);
        this.postMessage({cmd: Pool.TASK_RESULT, id: id, result: res});
        
      } catch (exc) {
        this.postError("Error running: " + funcname + " from " + script + ": ", exc);
      }
      this.setBusy(false);
    }
  }

  this.requestTask();
};

/** When no task is available from the pool, wait for new tasks to arrive. */
Slave.prototype.noTask = function() {
  this.request_pending = false;
};


//
// Main entry point of the worker script: creates a slave and register its message loop
//
var slave = new Slave();

self.addEventListener('message', function(e) { slave.handleMessage(e); }, false);
