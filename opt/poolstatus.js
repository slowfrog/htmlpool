//
// (c) 2011 Laurent Vaucher
// http://www.slowfrog.com
// This file is under Apache License V2
//
"use strict";

/** This is an example class that receives events about the status of a pool of workers and displays
 *  graphical information.
 */
var PoolStatus = function(elem) {
  this.elem = elem;
  this.queue_label = document.createElement("span");
  this.queue_label.innerHTML = "Queue size: ";
  this.elem.appendChild(this.queue_label);

  this.queue = document.createElement("div");
  this.queue.innerHTML = "0";
  var style = this.queue.style;
  style.display = "inline-block";
  style.border = "1px solid gray";
  style.width = "0px";
  style.height = "20px";
  style.lineHeight = "20px";
  style.color = "black";
  style.backgroundColor = "#eee";
  style.fontWeight = "bold";
  style.textAlign = "center";
  this.elem.appendChild(this.queue);
  this.br = document.createElement("br");
  this.elem.appendChild(this.br);

  this.workers = [];
}

/** Color of the indicator when a worker is idle. Not too flashy green. */
PoolStatus.IDLE_COLOR = "#0c0";
/** Color of the indicator when a worker is busy. Full red. */
PoolStatus.BUSY_COLOR = "#f00";

/** Method called when a worker is added to the pool.
 *
 *  @param i index of the worker
 */
PoolStatus.prototype.addWorker = function(i) {
  var w = document.createElement("div");
  var style = w.style;
  style.display = "inline-block";
  style.border = "1px solid gray";
  style.margin = "4px";
  style.width = "20px";
  style.height = "20px";
  style.lineHeight = "20px";
  style.color = "white";
  style.backgroundColor = PoolStatus.IDLE_COLOR;
  style.fontWeight = "bold";
  style.textAlign = "center";
  w.innerHTML = i;
  this.elem.appendChild(w);
  this.workers[i] = w;
};

/** Method called when a worker is removed from the pool.
 *
 *  @param i index of the removed worker
 */
PoolStatus.prototype.removeWorker = function(i) {
  this.workers[i].parentNode.removeChild(this.workers[i]);
  this.workers[i] = null;
};

/** Method called when a worker changes its busy state.
 *
 *  @param i index of the worker that changed states
 *  @param busy <code>true</code> if the worker just became busy, <code>false</code> if it turned
 *              idle
 */
PoolStatus.prototype.setBusy = function(i, busy) {
  var color = busy ? PoolStatus.BUSY_COLOR : PoolStatus.IDLE_COLOR;
  this.workers[i].style.backgroundColor = color;
};

/** Method called when the length of the task queue has changed.
 *
 *  @param l length of the task queue
 */
PoolStatus.prototype.setQueueLength = function(l) {
  this.queue.innerHTML = l;
  this.queue.style.width = (20 * l) + "px";
};

/** Method called when the whole pool has been killed. */
PoolStatus.prototype.kill = function() {
  this.elem.removeChild(this.queue_label);
  this.elem.removeChild(this.queue);
  this.elem.removeChild(this.br);
};
