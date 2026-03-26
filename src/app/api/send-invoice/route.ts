import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface InvoiceRecipient {
  companyName: string;
  email: string;
  contactName: string;
  pdfBase64: string; // base64 encoded PDF data
}

interface SendInvoiceRequest {
  recipients: InvoiceRecipient[];
  subject: string;
  body: string;
  senderName: string;
  invoiceMonth: string;
}

export async function POST(req: NextRequest) {
  try {
    const { recipients, subject, body, senderName, invoiceMonth } =
      (await req.json()) as SendInvoiceRequest;

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "RESEND_API_KEY が設定されていません" },
        { status: 500 }
      );
    }

    const results: {
      companyName: string;
      email: string;
      success: boolean;
      error?: string;
    }[] = [];

    // ドメイン認証前は onboarding@resend.dev を使用
    const fromAddress = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const fromLabel = senderName || "請求書送付";

    for (const recipient of recipients) {
      if (!recipient.email) {
        results.push({
          companyName: recipient.companyName,
          email: "",
          success: false,
          error: "メールアドレス未設定",
        });
        continue;
      }

      try {
        // 企業名ごとにパーソナライズした件名
        const personalizedSubject = subject;
        // 本文（宛名を追加）
        const personalizedBody = recipient.contactName
          ? `${recipient.companyName}\n${recipient.contactName} 様\n\n${body}`
          : `${recipient.companyName} 御中\n\n${body}`;

        await resend.emails.send({
          from: `${fromLabel} <${fromAddress}>`,
          to: [recipient.email],
          subject: personalizedSubject,
          text: personalizedBody,
          attachments: [
            {
              filename: `請求書_${invoiceMonth}_${recipient.companyName}.pdf`,
              content: recipient.pdfBase64,
              contentType: "application/pdf",
            },
          ],
        });

        results.push({
          companyName: recipient.companyName,
          email: recipient.email,
          success: true,
        });
      } catch (e) {
        results.push({
          companyName: recipient.companyName,
          email: recipient.email,
          success: false,
          error: e instanceof Error ? e.message : "送信失敗",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      results,
      summary: {
        total: recipients.length,
        success: successCount,
        failed: failCount,
      },
    });
  } catch (e) {
    console.error("Send invoice error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "送信エラー" },
      { status: 500 }
    );
  }
}
