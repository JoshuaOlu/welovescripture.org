export default { layout: 'layouts/project.njk', tags: ['project'], kind: 'project', eleventyComputed: { permalink: d => `/projects/${d.page.fileSlug}/` } };
