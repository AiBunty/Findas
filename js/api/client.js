function localDataFor(name) {
  if (!LOCAL_DATA) return null;
  if (name === 'getGlobalSettings') return LOCAL_DATA.global_settings || LOCAL_DATA.settings || {};
  if (name === 'getCourses') return LOCAL_DATA.courses || [];
  if (name === 'getCourseDetails') return LOCAL_DATA.course_details || null;
  if (name === 'getDigitalProducts') return LOCAL_DATA.digital_products || LOCAL_DATA.digital || [];
  if (name === 'getDigitalProductDetails') return LOCAL_DATA.digital_product_details || null;
  if (name === 'getWebinars') return LOCAL_DATA.webinars || [];
  if (name === 'getWebinarDetails') return LOCAL_DATA.webinar_details || null;
  if (name === 'getMembershipPlans') return LOCAL_DATA.membership_plans || LOCAL_DATA.memberships || [];
  if (name === 'getBookingPage') return LOCAL_DATA.booking_page || {};
  if (name === 'getGalleryImages') return LOCAL_DATA.gallery_images || [];
  if (name === 'getShortReviews') return LOCAL_DATA.short_reviews || [];
  if (name === 'getFeaturedReviews') return LOCAL_DATA.featured_reviews || [];
  if (name === 'getFAQ') return LOCAL_DATA.faq || null;
  if (name === 'getWhoFor') return LOCAL_DATA.who_for || null;
  if (name === 'getAcademySections') return LOCAL_DATA.academy_sections || null;
  if (name === 'getAcademyBefore') return LOCAL_DATA.academy_before || null;
  if (name === 'getAcademyAfter') return LOCAL_DATA.academy_after || null;
  if (name === 'getAcademyRoadmap') return LOCAL_DATA.academy_roadmap || null;
  if (name === 'getAcademyCommunityPosts') return LOCAL_DATA.academy_community_posts || null;
  return null;
}

function run(name, params) {
  return new Promise(function(ok, bad) {
    const local = localDataFor(name);
    if (local !== null) {
      ok(local);
      return;
    }
    runPhpApi(name, params)
      .then(function(data) {
        writeApiCache(name, params, data);
        ok(data);
      })
      .catch(function(err) {
        const cached = readApiCache(name, params);
        if (cached !== null) {
          console.warn('Using cached API data for', name, err && err.message ? err.message : err);
          ok(cached);
          return;
        }
        bad(err);
      });
  });
}

async function runOptional(name, fallback) {
  try {
    const data = await run(name);
    return data == null ? fallback : data;
  } catch (e) {
    return fallback;
  }
}
