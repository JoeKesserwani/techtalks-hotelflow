
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

import { requireAuth } from "../../../../../lib/middleware/requireAuth";
import {
  ApiError,
  handleRouteError,
} from "../../../../../lib/api/errors";

export async function POST(req: Request) {
  try {
    // Check that the user is authenticated and has permission
    // to upload housekeeping photos.
    const user = await requireAuth({
      roles: ["ADMIN", "MANAGER", "RECEPTIONIST", "HOUSEKEEPING"],
    });

    if (!user) {
      throw new ApiError("Unauthorized", 401);
    }

    // Read the uploaded file from FormData.
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiError("No image file provided", 400);
    }

    // Make sure the uploaded file is an image.
    if (!file.type.startsWith("image/")) {
      throw new ApiError("Only image files are allowed", 400);
    }

    // Maximum file size: 10 MB.
    const maxSize = 10 * 1024 * 1024;

    if (file.size > maxSize) {
      throw new ApiError("Image must be smaller than 10 MB", 400);
    }

    // Get the file extension.
    const extension =
      file.name.split(".").pop()?.toLowerCase() || "jpg";

    // Supported image formats.
    const allowedExtensions = [
      "jpg",
      "jpeg",
      "png",
      "webp",
      "gif",
    ];

    if (!allowedExtensions.includes(extension)) {
      throw new ApiError("Unsupported image format", 400);
    }

    // Generate a unique filename so uploaded files
    // do not overwrite each other.
    const fileName = `${randomUUID()}.${extension}`;

    // Store images inside:
    // public/uploads/housekeeping
    const uploadDirectory = path.join(
      process.cwd(),
      "public",
      "uploads",
      "housekeeping"
    );

    // Create the directory if it does not already exist.
    await mkdir(uploadDirectory, { recursive: true });

    // Full path where the image will be saved.
    const filePath = path.join(
      uploadDirectory,
      fileName
    );

    // Convert the uploaded file into a Buffer.
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save the image.
    await writeFile(filePath, buffer);

    /*
     * IMPORTANT:
     *
     * Return an absolute URL instead of:
     *
     * /uploads/housekeeping/example.jpg
     *
     * Your complete-task validator uses:
     *
     * z.string().url()
     *
     * so it requires a valid URL.
     */
    const url = new URL(
      `/uploads/housekeeping/${fileName}`,
      req.url
    ).toString();

    return Response.json({
      url,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

