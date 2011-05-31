//
// (c) 2011 Laurent Vaucher
// http://www.slowfrog.com
// This file is under Apache License V2
//
"use strict";

/** This is the main class. It creates a pool of workers and a task queue.
 *
 *  @param count number of workers to start
 *  @param prefix URL prefix to find slave.js
 *  @param log_to_console <code>true</code> to send debug information to console.log(),
 *                        console.warn() and console.error(). If <code>false</code>, only errors
 *                        are displayed as alert().
 *  @param status an optional object that will receive notification about workers and the queue.
 *                See poolstatus.js for an example implementation
 */
var Pool = function(count, prefix, log_to_console, status) {
  var that = this;
  this.queue = [];
  this.statusSetQueueLength(this.queue.length);
  this.task_id = 0;
  this.callbacks = [];
  this.configureLogging(log_to_console);
  this.status = status;

  this.workers = [];

  var slavejs = (prefix ? (prefix + "/") : "") + "slave.js";
  for (var i = 0; i < count; ++i) {
    this.statusAddWorker(i);

    this.workers[i] = new Worker(slavejs);
    this.workers[i].addEventListener("message", Pool.makeMessageHandler(that, i), false);
    this.workers[i].addEventListener("error", Pool.makeErrorHandler(that, i), false);
    this.workers[i].postMessage({cmd: Pool.SET_ID, id: i});
  }
  this.log("Pool created with " + count + " slaves");
};

/** Enqueues a task to be processed by workers. If the queue was empty, broadcast a message to all
 *  slaves so that they can request a task.
 *
 * @param task task to be processed. Must be a "marshallable" object. No reference to the DOM will
 *             be admitted
 * @param callback function that will be called with the result of the task
 */
Pool.prototype.postTask = function(task, callback) {
  this.queue.push({task: task, callback: callback});
  if (this.queue.length == 1) {
    this.broadcastMessage({cmd: Pool.NEW_TASK});
  }
  this.statusSetQueueLength(this.queue.length);
};

/** Kills the pool. Sends a kill message to all workers. */
Pool.prototype.kill = function() {
  this.broadcastMessage({cmd: Pool.KILL});
  this.statusKill();
};


//
// All the rest should remain private
//
/** Configures logging function according the preferences.
 *
 * @param log_to_console <code>true</code> to send all logs to console, <code>false</code> to
 *                       send only errors to alert()
 */
Pool.prototype.configureLogging = function(log_to_console) {
  if (log_to_console) {
    this.log = function() {
      console.debug.apply(console, arguments);
    }
    this.warn = function() {
      console.warn.apply(console, arguments);
    }
    this.error = function() {
      console.error.apply(console, arguments);
    }
  } else {
    this.log = function() {};
    this.warn = function() {};
    this.error = function(e) {
      alert(e);
    };
  }
};

/** Makes a closure to handle messages.
 *
 * @param that target object
 * @param i closed-over index
 * @return a callback bound to that and closed over i
 */
Pool.makeMessageHandler = function(that, i) {
  return function(ev) { that.handleMessage(ev, i); };
}

/** Makes a closure to handle errors.
 *
 * @param that target object
 * @param i closed-over index
 * @return a callback bound to that and closed over i
 */
Pool.makeErrorHandler = function(that, i) {
  return function(ev) { that.handleError(ev, i); };
}

// Pool messages
/** Message sent by slave when is starts processing a task. */
Pool.BUSY = "busy";
/** Message sent by slave when an error occurs. */
Pool.ERROR = "error";
/** Message sent by slave when it finishes processing a task. */
Pool.IDLE = "idle";
/** Message broadcast by pool to ask all slaves to close. */
Pool.KILL = "kill";
/** Message broadcast by pool when the queue goes from empty to containing one task. */
Pool.NEW_TASK = "new_task";
/** Message sent by pool in response to REQUEST_TASK, to notify that no tasks are available. */
Pool.NO_TASK = "no_task";
/** Message sent by slave to ask for a task. */
Pool.REQUEST_TASK = "request_task";
/** Message sent by pool to assign an identifier to a slave. */
Pool.SET_ID = "set_id";
/** Message sent by pool in response to REQUEST_TASK, to provide a task to a slave. */
Pool.START_TASK = "start_task";
/** Message sent by slave containing the results of the task. */
Pool.TASK_RESULT = "task_result";
/** Message sent by slave just before closing. */
Pool.WORKER_CLOSED = "worker_closed";

/** Big message handling function. That's where the communication protocol lives.
 *
 * @param ev message event
 * @param i index of the slave who sent the message
 */
Pool.prototype.handleMessage = function(ev, i) {
  var data = ev.data;
  if (data.cmd) {
    switch (data.cmd) {
    case Pool.REQUEST_TASK:
      this.provideTask(i);
      break;

    case Pool.BUSY:
      this.statusSetBusy(i, true);
      break;

    case Pool.IDLE:
      this.statusSetBusy(i, false);
      break;

    case Pool.TASK_RESULT:
      this.receiveResults(data.id, data.result, i);
      break;

    case Pool.WORKER_CLOSED:
      this.statusRemoveWorker(i);
      break;

    case Pool.ERROR:
      this.receiveError(data.args, i);
      break;
      
    default:
      this.warn("Unknown command: " + data.cmd, data);
    }
    
  } else if (data.msg) {
    this.log("Message from " + i + ": ", data.msg);
  } else {
    this.log("Received from " + i, data);
  }
};

/** I have to admin that error handling is poor at that time.
 *
 * @param ev error event
 * @param i index of slave who sent the error
 */
Pool.prototype.handleError = function(ev, i) {
  this.error("Error from " + i + ": ", ev);
};

/** Posts a message to one slave.
 *
 * @param msg complete message to post. Will be received in ev.data on the other side
 * @param i index of the recipient slave
 */
Pool.prototype.postMessage = function(msg, i) {
  var w = this.workers[i];
  if (w) {
    w.postMessage(msg);
  }
};

/** Broadcasts a message to all live slaves.
 *
 * @param msg complete message to broadcast.
 */
Pool.prototype.broadcastMessage = function(msg) {
  for (var i = 0; i < this.workers.length; ++i) {
    this.postMessage(msg, i);
  }
};

/** Called when a slave asked for a task and the queue is not empty. Will provide the next
 *  available task to the slave.
 *
 * @param i index of the slave asking for a task
 */
Pool.prototype.provideTask = function(i) {
  if (this.queue.length > 0) {
    var task_def = this.queue.shift();
    ++this.task_id;
    this.callbacks[this.task_id] = task_def.callback;
    this.log("#" + i + " sending task", task_def.task);
    this.postMessage({cmd: Pool.START_TASK, id: this.task_id, task: task_def.task}, i);
    this.statusSetQueueLength(this.queue.length);
  } else {
    this.log("#" + i + " no tasks available");
    this.postMessage({cmd: Pool.NO_TASK}, i);
  }
};

/** The result of a task has been received. Call the callback registered when the task was posted,
 *  if there is one.
 *
 * @param res task result from the slave message
 * @param i index of the slave that processed the task
 */
Pool.prototype.receiveResults = function(id, result, i) {
  if (id === undefined) {
    this.warn("Unidentified task result from #" + i, result);
    return;
  }
  var callback = this.callbacks[id];
  if (callback) {
    this.callbacks[id] = null;
    callback.call(null, result);
  }
};

/** An 'expected' error has been received from a slave.
 *
 * @param err error message received
 * @param i index of the slave sending the error
 */
Pool.prototype.receiveError = function(err, i) {
  this.error("#" + i + " ERROR: " + err.msg, err.exception);
};

/** Work done when a slave closes.
 *
 * @param i index of the slave that closes
 */
Pool.prototype.workerClosed = function(i) {
  this.workers[i] = null;
  this.statusRemoveWorker(i);
};

//
// Notification methods
//

Pool.prototype.statusAddWorker = function(i) {
  if (this.status) {
    this.status.addWorker(i);
  }
};

Pool.prototype.statusRemoveWorker = function(i) {
  if (this.status) {
    this.status.removeWorker(i);
  }
};

Pool.prototype.statusSetBusy = function(i, busy) {
  if (this.status) {
    this.status.setBusy(i, busy);
  }
};

Pool.prototype.statusSetQueueLength = function(l) {
  if (this.status) {
    this.status.setQueueLength(l);
  }
};

Pool.prototype.statusKill = function() {
  if (this.status) {
    this.status.kill();
  }
};
