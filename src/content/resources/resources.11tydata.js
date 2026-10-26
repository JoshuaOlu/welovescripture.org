import { TYPES } from '../../../lib/util.mjs';
export default {
  layout: 'layouts/resource.njk', tags: ['resource'], kind: 'resource',
  eleventyComputed: { permalink: d => `/${TYPES[d.type]?.dir || 'read'}/${d.page.fileSlug}/` },
};
