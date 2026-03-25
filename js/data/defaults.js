function getDefaultFAQ() {
  return [
    { question: 'What is the refund policy?', answer: 'We offer a full refund within 14 days of purchase if you are not satisfied with the course or product. No questions asked. Simply reach out to our support team.' },
    { question: 'Are courses self-paced?', answer: 'Yes! All courses are completely self-paced with lifetime access. You can learn at your own speed, anytime, anywhere.' },
    { question: 'Is there any live interaction?', answer: 'Most courses include access to live group Q&A sessions where you can ask questions and get feedback from our instructors.' },
    { question: 'Do I need any prior experience?', answer: 'Most of our courses are designed for everyone, regardless of prior experience. Just get started and learn at your own pace.' },
    { question: 'Can I take multiple courses?', answer: 'Absolutely! There are no limits. We encourage you to explore and take any courses that interest you.' },
    { question: 'Is there a community?', answer: 'Yes, premium members get access to our exclusive community where you can connect with fellow learners and network.' }
  ];
}

function getDefaultWhoFor() {
  return [
    { icon: 'BEGIN', title: 'Beginners', description: 'Start your financial journey from scratch with foundational knowledge.' },
    { icon: 'PRO', title: 'Professionals', description: 'Enhance your financial skills while managing a busy career.' },
    { icon: 'INV', title: 'Investors', description: 'Deepen your investment knowledge and build a stronger portfolio.' },
    { icon: 'BIZ', title: 'Entrepreneurs', description: 'Master financial management for your business or startup.' },
    { icon: 'FAM', title: 'Parents', description: 'Manage personal finances while balancing family responsibilities.' },
    { icon: 'GOAL', title: 'Goal Seekers', description: 'Create and achieve clear financial objectives with our guidance.' }
  ];
}

function getDefaultAcademySections() {
  return [
    { id: 1, title: 'Book of the Month', description: 'Powerful books on success, wealth, mindset, and growth with actionable insights every week.', icon_emoji: '📚', is_active: 1, order: 1 },
    { id: 2, title: 'Weekly Learning Videos', description: 'Focused 15-30 min videos on wealth creation, investing, insurance, and financial planning.', icon_emoji: '🎬', is_active: 1, order: 2 },
    { id: 3, title: 'Daily Dose of Insights', description: 'Two-minute daily insights with one action step to improve thinking and build momentum.', icon_emoji: '💡', is_active: 1, order: 3 },
    { id: 4, title: 'Monthly Challenges', description: 'Budgeting, habits, gratitude, and investing challenges that build financial discipline.', icon_emoji: '🏆', is_active: 1, order: 4 },
    { id: 5, title: 'Live Q&A Sessions', description: 'Monthly live session where members ask questions and get advice directly from experts.', icon_emoji: '🎯', is_active: 1, order: 5 },
    { id: 6, title: 'Community Forum', description: 'Safe space to ask questions, share wins, and learn from thousands of members.', icon_emoji: '👥', is_active: 1, order: 6 }
  ];
}

function getDefaultAcademyBefore() {
  return [
    { challenge: 'Confusion about how money really works' },
    { challenge: 'Irregular saving and investing habits' },
    { challenge: 'Lack of clarity about financial goals' },
    { challenge: 'Learning from scattered sources' },
    { challenge: 'No accountability or support' }
  ];
}

function getDefaultAcademyAfter() {
  return [
    { benefit: 'Clear understanding of financial systems' },
    { benefit: 'Structured learning about wealth creation' },
    { benefit: 'Practical tools to build financial discipline' },
    { benefit: 'Continuous insights that improve thinking' },
    { benefit: 'A community that encourages growth' }
  ];
}

function getDefaultAcademyRoadmap() {
  return [
    { stage_num: 1, stage_name: 'Awareness', description: 'Understand how money works and improve financial literacy.' },
    { stage_num: 2, stage_name: 'Systems', description: 'Build simple systems like budgeting and goal planning.' },
    { stage_num: 3, stage_name: 'Wealth Creation', description: 'Learn investing principles and long-term wealth strategies.' },
    { stage_num: 4, stage_name: 'Mindset Upgrade', description: 'Develop an abundance mindset through daily insights and books.' },
    { stage_num: 5, stage_name: 'Life by Design', description: 'Design your life intentionally instead of reacting to circumstances.' }
  ];
}

function getDefaultAcademyCommunityPosts() {
  return [
    { id: 1, post_type: 'Daily Dose', content: '💡 Two-minute insight: track every rupee for the next 7 days to improve awareness.', author: 'Findas Team', created_at: '2026-03-25 09:00:00', is_active: 1 },
    { id: 2, post_type: 'Weekly Learning', content: '🎬 New video: Building your first long-term investment system without overwhelm.', author: 'Samir Machawe', created_at: '2026-03-24 14:30:00', is_active: 1 },
    { id: 3, post_type: 'Success Story', content: '🎯 Members are sharing wins from the budgeting challenge - 47 people saved ₹50K+ this month!', author: 'Community', created_at: '2026-03-23 11:00:00', is_active: 1 },
    { id: 4, post_type: 'Ask for Help', content: '❓ "How do I start investing with just ₹5,000?" - Answered by 12 community members with practical steps.', author: 'Rajesh K.', created_at: '2026-03-22 16:45:00', is_active: 1 },
    { id: 5, post_type: 'Book of the Month', content: '📚 Atomic Habits by James Clear - Discussion: How to build one small financial habit daily?', author: 'Priya S.', created_at: '2026-03-21 10:15:00', is_active: 1 },
    { id: 6, post_type: 'Challenge', content: '🏆 New Monthly Challenge: "Emergency Fund Sprint" - Build or complete your 6-month fund!', author: 'Findas Team', created_at: '2026-03-20 08:00:00', is_active: 1 }
  ];
}

function getDefaultAcademyFaq() {
  return [
    { question: 'What do I get when I join Findas Academy?', answer: 'You get access to all courses, channels, tools, challenges, and discussions inside the community.' },
    { question: 'Are the courses included in membership?', answer: 'Yes. All resources inside the community are included once you join.' },
    { question: 'Is this suitable for beginners?', answer: 'Yes. The content is designed for both beginners and experienced learners.' },
    { question: 'How much time do I need each week?', answer: 'Even 15 to 20 minutes per day can create meaningful progress.' },
    { question: 'What if this is not right for me?', answer: 'Every new member gets a 14-day free look period.' }
  ];
}
