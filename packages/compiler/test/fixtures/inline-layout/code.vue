<template>
  <div class="paragraph">Before <span class="emphasis">large <span class="raised">raised</span></span><br>after <span class="badge">42</span>.</div>
</template>

<style>
.paragraph { display: block; font-size: 16px; line-height: 24px; }
.emphasis { display: inline; font-size: 32px; line-height: 38px; vertical-align: baseline; }
.raised { vertical-align: 25%; }
.badge { display: inline-block; width: 40px; height: 30px; vertical-align: middle; }
.top { vertical-align: top; }
.bottom { vertical-align: bottom; }
.text-top { vertical-align: text-top; }
.text-bottom { vertical-align: text-bottom; }
.sub { vertical-align: sub; }
.super { vertical-align: super; }
.offset { vertical-align: -5px; }
</style>
