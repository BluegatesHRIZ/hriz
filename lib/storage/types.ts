/**
 * Storage Service Interface
 * Provider-agnostic interface for S3-compatible storage operations
 */
export interface IStorageService {
  /**
   * Upload a file to storage
   * @param file Buffer containing file data
   * @param path Storage path (e.g., "employee", "leave", "medical")
   * @param filename Unique filename (will be prefixed with path)
   * @returns Public URL or path to the uploaded file
   */
  uploadFile(file: Buffer, path: string, filename: string): Promise<string>

  /**
   * Delete a file from storage
   * @param filePath Full path to the file in storage
   */
  deleteFile(filePath: string): Promise<void>

  /**
   * Get a public URL for a file
   * @param filePath Path to the file in storage
   * @returns Public URL that can be used to access the file
   */
  getFileUrl(filePath: string): Promise<string>

  /**
   * List files with a given prefix
   * @param prefix Path prefix to filter files
   * @returns Array of file paths
   */
  listFiles(prefix: string): Promise<string[]>
}
