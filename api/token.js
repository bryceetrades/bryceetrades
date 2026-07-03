export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    // We'll complete this in the next step.
    return res.status(200).json({
        message: "API is working"
    });
}