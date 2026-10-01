---
layout: default
title: Archive
permalink: /
---

# Copilot Changelog Archive

Browse the mirrored posts below. Each article includes its source URL and archive time; the original publication time appears when it was available in the feed.

{% assign posts = site.archive | sort: "title" %}
{% if posts.size == 0 %}
There are no archived posts yet.
{% else %}
<ul>
{% for post in posts %}
  <li><a href="{{ post.url | relative_url }}">{{ post.title | replace: '-', ' ' | replace: '_', ' ' | capitalize | escape }}</a></li>
{% endfor %}
</ul>
{% endif %}
