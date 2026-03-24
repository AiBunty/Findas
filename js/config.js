const K = 'findas_lite_cart_v1';
const API_CACHE_PREFIX = 'findas_api_cache_v1:';
const API_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const API_MAX_ATTEMPTS = 4;
const API_RETRY_BASE_MS = 650;
const API_JSONP_TIMEOUT_MS = 40000;
const DEFAULT_PAGE_LOADER_TEXT = 'Loading Your Academy';
const API_CACHEABLE_METHODS = {
  getGlobalSettings: true,
  getSiteConfig: true,
  getCourses: true,
  getDigitalProducts: true,
  getWebinars: true,
  getMembershipPlans: true,
  getGalleryImages: true,
  getShortReviews: true,
  getFeaturedReviews: true,
  getFAQ: true,
  getWhoFor: true,
  getAcademySections: true,
  getAcademyBefore: true,
  getAcademyAfter: true,
  getAcademyRoadmap: true,
  getAcademyCommunityPosts: true,
  getBookingPage: true,
  getCourseDetails: true,
  getDigitalProductDetails: true,
  getWebinarDetails: true
};
