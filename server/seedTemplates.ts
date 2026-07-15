import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const welcomeHtml = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
  <h2 style="color: #4CAF50;">Welcome to AlgoConnect!</h2>
  <p>Hello {{name}},</p>
  <p>Thank you for connecting with us. We are thrilled to introduce you to our premium offerings designed to streamline your operations and boost your productivity.</p>
  
  <h3>🚀 AlgoProduct</h3>
  <p>Our flagship AlgoProduct is a state-of-the-art algorithmic trading and automation platform. It is built to execute strategies with precision and speed, giving you a competitive edge in the market.</p>
  
  <h3>📄 SOP Product</h3>
  <p>Standard Operating Procedures (SOPs) are critical for scale. Our SOP product provides you with ready-to-use, compliant frameworks and tools to document and enforce your business processes seamlessly.</p>
  
  <p>If you are interested in transforming your business with our solutions, let us know by clicking the button below:</p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="mailto:contact@algoconnect.com?subject=Interested in AlgoConnect Products" style="background-color: #4CAF50; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Yes, I am Interested!</a>
  </div>
  
  <p>For any queries, please feel free to reach out directly to my contact number: <strong>+91-9876543210</strong></p>
  
  <p>Best Regards,<br>The AlgoConnect Team</p>
</div>
`;

const demoHtml = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
  <h2 style="color: #2196F3;">AlgoConnect - Demo & Planning Details</h2>
  <p>Hi {{name}},</p>
  <p>We are excited to move forward with the demo for our AlgoProduct. Below you will find all the details regarding the demo, maintenance, and costing structure.</p>
  
  <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #2196F3; margin-bottom: 20px;">
    <h3>🎯 Demo Description</h3>
    <p>The demo will be a comprehensive 45-minute walkthrough of the AlgoProduct. We will cover:</p>
    <ul>
      <li>Dashboard overview and real-time analytics</li>
      <li>Strategy configuration and backtesting</li>
      <li>Live execution modules</li>
      <li>Risk management settings</li>
    </ul>
  </div>
  
  <h3>💰 Costing Structure</h3>
  <p>Our pricing is transparent and designed to scale with your needs:</p>
  <ul>
    <li><strong>Setup Fee:</strong> ₹15,000 (One-time)</li>
    <li><strong>Monthly License:</strong> ₹5,000 / month</li>
  </ul>
  
  <h3>🔧 Maintenance & Support</h3>
  <p>We believe in providing continuous value. Our maintenance package includes:</p>
  <ul>
    <li>24/7 Server Monitoring and Uptime guarantee (99.9%)</li>
    <li>Weekly strategy optimizations and updates</li>
    <li>Dedicated support via phone and email during market hours</li>
  </ul>
  
  <p>Please let us know your available time slots for this week so we can schedule the demo accordingly.</p>
  
  <p>Best Regards,<br>The AlgoConnect Team<br>Contact: +91-9876543210</p>
</div>
`;

async function main() {
  console.log('Creating templates...');
  
  await prisma.messageTemplate.create({
    data: {
      name: 'Welcome & Product Info',
      subject: 'Welcome to AlgoConnect - Explore our Products',
      content: welcomeHtml,
      type: 'EMAIL',
      status: 'APPROVED',
      isShared: true
    }
  });

  await prisma.messageTemplate.create({
    data: {
      name: 'Demo Planning & Costing',
      subject: 'AlgoConnect Demo & Costing Details',
      content: demoHtml,
      type: 'EMAIL',
      status: 'APPROVED',
      isShared: true
    }
  });

  console.log('Templates created successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
