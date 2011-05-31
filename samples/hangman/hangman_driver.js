//
// (c) 2011 Laurent Vaucher
// http://www.slowfrog.com
// This file is under Apache License V2.
//
"use strict";

// Some ugly global variables
var pool;
var start;
var results;

var create = function() {
  if (pool) {
    alert("Pool already exists.\nPress \"Kill\" if you want to resize it.");
  } else {
    var count_txt = document.getElementById("worker_count").value;
    var count = parseInt(count_txt);
    if (!count) {
      alert("Invalid number of workers: " + count_txt);
      return;
    }
    
    var status = new PoolStatus(document.getElementById("status"));
    pool = new Pool(count, "../../src", true, status);
  }
};

var kill = function() {
  if (!pool) {
    return;
  }
  pool.kill();
  pool = null;
};


var run = function(input, output, use_workers) {
  start = new Date().getTime();
  results = [];
  var lines = input.value.split(/\n/);
  var l = 0;
  var T = parseInt(lines[l++]);
  for (var index = 1; index <= T; ++index) {
    var line = lines[l++].split(/\s/);
    var N = parseInt(line[0]);
    var M = parseInt(line[1]);
    var dic = [];
    var lists = [];
    for (var i = 0; i < N; ++i) {
      dic.push(lines[l++]);
    }
    for (i = 0; i < M; ++i) {
      lists.push(lines[l++]);
    }
    if (use_workers) {
      pool.postTask({script: "../samples/hangman/hangman_task.js", func: "process_task",
                     args: {index: index, dic: dic, lists: lists}},
                    function(res) { receive_result(T, output, res) });
    } else {
      receive_result(T, output, {index: index, result: solve_case(dic, lists)});
    }
  }
};


var receive_result = function(T, output, result) {
  console.log("Driver received result: " + result.index, result);
  results[result.index] = result.result;
  for (var i = 1; i <= T; ++i) {
    if (!results[i]) {
      return;
    }
  }
  console.log("All results received");
  // All results have arrived
  var res = "";
  for (var i = 1; i <= T; ++i) {
    res += "Case #" + i + ": " + results[i].join(" ") + "\n";
  }
  output.value = res;
  
  var end = new Date().getTime();
  var p = document.getElementById("runtime");
  p.innerHTML = "Runtime: " + ((end - start) / 1000) + " s.";
};

var run_all = function() {
  if (!pool) {
    alert("You should create a pool first");
    return;
  }
  var input = document.getElementById("input");
  var output = document.getElementById("output");
  output.value = "";
  run(input, output, true);
};

var run_without_workers = function() {
  var input = document.getElementById("input");
  var output = document.getElementById("output");
  output.value = "";
  run(input, output, false);
};