import nodemailer from 'nodemailer'

export async function sendEmail(req, res) {
    const transporter = nodemailer.createTransport({
        service: "Gmail",
        auth: {
            user: "fastcashmxec2024@gmail.com",
            pass: "tkhk ntnh wcyr tlql",
        },
    });
    try {
        await transporter.sendMail({
            from: 'fastcashmxec2024@gmail.com',
            to: req.body.email,
            subject: `${req.body.subject}`,
            html: req.body.html,
        });
        return res.json({ msg: 'Send Email SuccessFull' })
    } catch (err) {
        return res.json({ msg: `error ${err}` })
    }

}