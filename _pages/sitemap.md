---
layout: studio-entry
title: "Sitemap"
permalink: /sitemap/
sitemap: false
---

- [Yehang Zhang — Home](/)
- [Publications](/#publications)
- [Education & Experience](/#experience)
- [Notes](/#notes)
- [Photos](/#gallery)

## Papers

{% assign papers = site.publications | sort: 'date' | reverse %}
{% for paper in papers %}{% unless paper.published == false %}
- [{{ paper.title }}]({{ paper.url | prepend: site.baseurl }})
{% endunless %}{% endfor %}

{% if site.notes.size > 0 %}
## Notes

{% for note in site.notes %}{% unless note.published == false %}
- [{{ note.title }}]({{ note.url | prepend: site.baseurl }})
{% endunless %}{% endfor %}
{% endif %}

{% if site.photo_stories.size > 0 %}
## Photo stories

{% for story in site.photo_stories %}{% unless story.published == false %}
- [{{ story.title }}]({{ story.url | prepend: site.baseurl }})
{% endunless %}{% endfor %}
{% endif %}

[XML sitemap](/sitemap.xml)
