export default { layout: 'layouts/page.njk', kind: 'page', eleventyComputed: { permalink: d => `/${d.page.fileSlug}/` } };
