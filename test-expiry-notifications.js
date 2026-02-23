// Test script for expiry notifications
// Run this with: node test-expiry-notifications.js

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testExpiryNotifications() {
  console.log('🧪 Testing expiry notification system...');
  
  try {
    // Test 1: Check for existing license serials
    console.log('\n📋 Step 1: Checking license serials...');
    const { data: serials, error: serialsError } = await supabase
      .from('license_serials')
      .select(`
        *,
        licenses!inner(
          created_by, 
          item_description, 
          project_assign
        )
      `)
      .limit(5);
    
    if (serialsError) {
      console.error('❌ Error fetching serials:', serialsError);
      return;
    }
    
    console.log(`✅ Found ${serials?.length || 0} license serials`);
    
    if (serials && serials.length > 0) {
      console.log('\n📄 Sample serial data:');
      serials.forEach((serial, index) => {
        console.log(`${index + 1}. ${serial.serial_or_contract} - ${serial.licenses.item_description}`);
        console.log(`   Project: ${serial.licenses.project_assign}`);
        console.log(`   End Date: ${serial.end_date}`);
        console.log(`   Notify Before: ${serial.notify_before_days || 30} days`);
      });
    }
    
    // Test 2: Check user project assignments
    console.log('\n👥 Step 2: Checking user project assignments...');
    const { data: assignments, error: assignError } = await supabase
      .from('user_project_assigns')
      .select('*')
      .limit(5);
    
    if (assignError) {
      console.error('❌ Error fetching assignments:', assignError);
    } else {
      console.log(`✅ Found ${assignments?.length || 0} user project assignments`);
      
      if (assignments && assignments.length > 0) {
        console.log('\n📄 Sample assignments:');
        assignments.forEach((assign, index) => {
          console.log(`${index + 1}. User: ${assign.user_id} -> Project: ${assign.project_assign}`);
        });
      }
    }
    
    // Test 3: Check existing notifications
    console.log('\n🔔 Step 3: Checking existing notifications...');
    const { data: notifications, error: notifError } = await supabase
      .from('notifications')
      .select('*')
      .eq('type', 'expiry')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (notifError) {
      console.error('❌ Error fetching notifications:', notifError);
    } else {
      console.log(`✅ Found ${notifications?.length || 0} expiry notifications`);
      
      if (notifications && notifications.length > 0) {
        console.log('\n📄 Recent expiry notifications:');
        notifications.forEach((notif, index) => {
          console.log(`${index + 1}. ${notif.title}`);
          console.log(`   Message: ${notif.message}`);
          console.log(`   Created: ${notif.created_at}`);
        });
      }
    }
    
    // Test 4: Simulate sending a test notification
    console.log('\n📧 Step 4: Sending test notification...');
    
    // Get a test user email (you can modify this)
    const testEmail = 'ayezinhtun9@gmail.com';
    
    // Create a test notification
    const { data: newNotification, error: createError } = await supabase
      .from('notifications')
      .insert({
        type: 'expiry',
        title: 'TEST: License Expiry Notification',
        message: 'This is a test expiry notification to verify the email system works correctly.',
        user_id: 'test-user-id',
        is_read: false,
        priority: 'high',
        action_required: true,
        action_url: '/licenses'
      })
      .select()
      .single();
    
    if (createError) {
      console.error('❌ Error creating test notification:', createError);
    } else {
      console.log('✅ Test notification created:', newNotification.id);
      
      // Now send the email
      const { data: emailResult, error: emailError } = await supabase.functions.invoke(
        'send-email-notification',
        {
          body: {
            to: testEmail,
            subject: newNotification.title,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">License Management System</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">One Cloud Technology</p>
                </div>
                <div style="padding: 30px 20px; background: white; margin: 0 20px;">
                  <h2 style="color: #dc3545; margin: 0 0 20px 0; font-size: 22px; font-weight: 600;">
                    ⚠️ ${newNotification.title}
                  </h2>
                  <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                    ${newNotification.message}
                  </p>
                  <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 8px; margin: 25px 0;">
                    <h4 style="margin: 0 0 10px 0; color: #155724; font-size: 16px; font-weight: 600;">✅ Test Result:</h4>
                    <p style="margin: 0; color: #155724;">If you receive this email, the notification system is working correctly!</p>
                  </div>
                </div>
                <div style="background: #343a40; color: white; padding: 25px 20px; text-align: center; margin: 0 20px;">
                  <p style="margin: 0; font-size: 12px; color: #6c757d;">
                    © ${new Date().getFullYear()} One Cloud Technology. All rights reserved.
                  </p>
                </div>
              </div>
            `
          }
        }
      );
      
      if (emailError) {
        console.error('❌ Error sending test email:', emailError);
      } else {
        console.log('✅ Test email sent successfully!', emailResult);
      }
    }
    
    console.log('\n🎉 Test completed!');
    console.log('\n📋 Summary:');
    console.log('- License serials checked');
    console.log('- User assignments verified');
    console.log('- Existing notifications reviewed');
    console.log('- Test email sent to:', testEmail);
    console.log('\n💡 Next steps:');
    console.log('1. Check your email for the test notification');
    console.log('2. Verify the email formatting looks correct');
    console.log('3. Test the real expiry notification by calling forceSendExpiryReminders()');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testExpiryNotifications();
