/*
 Copyright (c) 2000  Oren Tirosh <oren@hishome.net>
 Copyright (c) 2014  Matt Brubeck <mbrubeck@limpet.net>

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
*/
(function(exports) {
console.log("mnemonic.js IIFE started");

var MN_BASE = 1626;                    /* cubic root of 2^32, rounded up */
var MN_REMAINDER = 7;                  /* extra words for 24 bit remainders */
var MN_WORDS = MN_BASE + MN_REMAINDER; /* total number of words */
var MN_WORD_BUFLEN = 25;               /* size for a word buffer+headroom */

/* Sample formats for mn_encode */
var MN_FDEFAULT           = "x-x-x--"
var MN_F64BITSPERLINE     = " x-x-x--x-x-x\n"
var MN_F96BITSPERLINE     = " x-x-x--x-x-x--x-x-x\n"
var MN_F128BITSPERLINE    = " x-x-x--x-x-x--x-x-x--x-x-x\n"
/* Note that the last format does not fit in a standard 80 character line */

var mn_words = [
  undefined,
  "academy",  "acrobat",  "active",   "actor",    "adam",     "admiral",
  "adrian",   "africa",   "agenda",   "agent",    "airline",  "airport",
  "aladdin",  "alarm",    "alaska",   "albert",   "albino",   "album",
  "alcohol",  "alex",     "algebra",  "alibi",    "alice",    "alien",
  "alpha",    "alpine",   "amadeus",  "amanda",   "amazon",   "amber",
  "america",  "amigo",    "analog",   "anatomy",  "angel",    "animal",
  "antenna",  "antonio",  "apollo",   "april",    "archive",  "arctic",
  "arizona",  "arnold",   "aroma",    "arthur",   "artist",   "asia",
  "aspect",   "aspirin",  "athena",   "athlete",   "atlas",    "audio",
  "august",   "austria",  "axiom",    "aztec",    "balance",  "ballad",
  "banana",   "bandit",   "banjo",    "barcode",  "baron",    "basic",
  "battery",  "belgium",  "berlin",   "bermuda",  "bernard",  "bikini",
  "binary",   "bingo",    "biology",  "block",    "blonde",   "bonus",
  "boris",    "boston",   "boxer",    "brandy",   "bravo",    "brazil",
  "bronze",   "brown",    "bruce",    "bruno",    "burger",   "burma",
  "cabinet",  "cactus",   "cafe",     "cairo",    "cake",     "calypso",
  "camel",    "camera",   "campus",   "canada",   "canal",    "cannon",
  "canoe",    "cantina",  "canvas",   "canyon",   "capital",  "caramel",
  "caravan",  "carbon",   "cargo",    "carlo",    "carol",    "carpet",
  "cartel",   "casino",   "castle",   "castro",   "catalog",  "caviar",
  "cecilia",  "cement",   "center",   "century",  "ceramic",  "chamber",