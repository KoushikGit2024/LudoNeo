import nodemailer from "nodemailer";
import dotenv from "dotenv";
import dns from "dns";



dotenv.config();

// Force Node to prefer IPv4 (fixes ENETUNREACH on many hosts like Render)
// dns.setDefaultResultOrder("ipv4first");

// import nodemailer from 'nodemailer'; // Assuming ES modules
dns.lookup("smtp.gmail.com", (err, address) => {
  console.log(err, address);
});

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,            // Changed to 465
    secure: true,         // Changed to true (required for 465)
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Test the connection immediately when the server starts
transporter.verify((error, success) => {
    if (error) {
        console.error("🔴 Nodemailer Config Error:", error);
    } else {
        console.log("🟢 Mail server is ready to send messages.",success);
    }
});

export const sendEmail = async ({ email, subject, message }) => {
    // try {
    //     const info = await transporter.sendMail({
    //         from: `"Ludo Neo" <${process.env.EMAIL_USER}>`,
    //         to: email,
    //         subject,
    //         html: message,
    //     });

    //     console.log("Email sent:", info);
    //     return info;
    // } catch (error) {
    //     console.error("Email send failed:", error);
    //     throw error;
    // }
};
// import { Resend } from "resend";
// import dotenv from "dotenv";

// dotenv.config();

// const resend = new Resend(process.env.RESEND_API_KEY);
// // console.log(process.env.RESEND_API_KEY);
// export const sendEmail = async ({ email, subject, message }) => {
//   try {
//     const response = await resend.emails.send({
//       from: `Ludo Neo <onboarding@resend.dev>`,
//       to: email,
//       subject: subject,
//       html: message
//     });
//     // resend.emails.
//     console.log("✅ Email sent to ",email," : ", response);
//     return response;
 
//   } catch (error) {
//     console.error("❌ Email send failed:", error);
//     throw error;
//   }
// };

// import * as SibApiV3Sdk from "@getbrevo/brevo";
// console.log(SibApiV3Sdk)
// const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

// apiInstance.setApiKey(
//   SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
//   process.env.BREVO_API_KEY
// );

// export const sendEmail = async ({ email, subject, message }) => {
//   try {
//     const sendSmtpEmail = {
//       sender: {
//         email: process.env.EMAIL_FROM,
//         name: "Ludo Neo"
//       },
//       to: [{ email }],
//       subject: subject,
//       htmlContent: message
//     };

//     const data = await apiInstance.sendTransacEmail(sendSmtpEmail);

//     console.log("Email sent:", data.messageId);
//   } catch (err) {
//     console.error("Email error:", err);
//   }
// };
// import axios from "axios";
// import dotenv from "dotenv";

// dotenv.config();

// export const sendEmail = async ({ email, subject, message }) => {
//   try {

//     const response = await axios.post(
//       "https://api.brevo.com/v3/smtp/email",
//       {
//         sender: {
//           name: "Ludo Neo",
//           email: process.env.EMAIL_FROM
//         },
//         to: [{ email }],
//         subject: subject,
//         htmlContent: message
//       },
//       {
//         headers: {
//           "api-key": process.env.BREVO_API_KEY,
//           "Content-Type": "application/json"
//         }
//       }
//     );

//     console.log("✅ Email sent:", response);

//   } catch (error) {
//     console.error("❌ Email failed:", error);
//   }
// };


// import axios from "axios";
// import dotenv from "dotenv";

// dotenv.config();

// export const sendEmail = async ({ email, subject, message }) => {
//   try {
//     const response = await axios.post(
//       "https://api.brevo.com/v3/smtp/email",
//       {
//         sender: {
//           name: "Ludo Neo",
//           email: process.env.EMAIL_FROM // Ensure this is a verified sender in Brevo
//         },
//         to: [{ email }],
//         subject: subject,
//         htmlContent: message
//       },
//       {
//         headers: {
//           "api-key": process.env.BREVO_API_KEY,
//           "Content-Type": "application/json"
//         }
//       }
//     );

//     console.log("✅ Email sent successfully. Message ID:",email,":", response.data);
//     if(!response?.data?.messageId){
//       throw new Error("Email delivery failed");
//     }
//     return true;

//   } catch (error) {
//     // This digs into the Axios error object to show exactly what Brevo is complaining about
//     const errorMessage = error.response?.data?.message || error.message;
//     console.error("❌ Email failed to send:", error);
    
//     // Throw the error so the controller calling this function knows it failed
//     throw new Error(`Email delivery failed: ${errorMessage}`);
//   }
// };