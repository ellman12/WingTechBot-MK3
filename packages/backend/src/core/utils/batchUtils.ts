// Calculate optimal batch size based on database parameter limits.
// PostgreSQL has a limit of ~32,767 parameters per query.
export function calculateOptimalBatchSize(paramsPerItem: number, maxParams = 30000): number {
    if (paramsPerItem <= 0) {
        throw new Error("paramsPerItem must be positive");
    }
    // Use 30k as safety margin under PostgreSQL's 32,767 limit
    return Math.floor(maxParams / paramsPerItem);
}

// Determines if an error indicates the batch size is too large and should be retried with a smaller batch.
function shouldRetryWithSmallerBatch(error: unknown): boolean {
    if (!error) return false;

    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    // PostgreSQL and database errors that suggest batch size issues
    return (
        errorMessage.includes("too many") ||
        errorMessage.includes("parameter") ||
        errorMessage.includes("limit exceeded") ||
        errorMessage.includes("out of memory") ||
        errorMessage.includes("query too large") ||
        errorMessage.includes("max_allowed_packet")
    );
}

//Executes batched operations with calculated optimal batch size and retry logic.
//Starts with the theoretical maximum based on parameter count, retries with smaller batches if errors occur.
export async function executeBatchWithAdaptiveSize<T>(items: T[], operation: (batch: T[]) => Promise<void>, operationName: string, paramsPerItem: number, minBatchSize = 10): Promise<void> {
    if (items.length === 0) return;

    const optimalBatchSize = calculateOptimalBatchSize(paramsPerItem);
    let batchSize = optimalBatchSize;
    let offset = 0;

    console.log(`[${operationName}] Processing ${items.length} items with optimal batch size ${optimalBatchSize}`);

    while (offset < items.length) {
        const batch = items.slice(offset, offset + batchSize);

        try {
            await operation(batch);
            offset += batchSize;
        } catch (error) {
            // If batch failed and we can retry with smaller size
            if (shouldRetryWithSmallerBatch(error) && batchSize > minBatchSize) {
                batchSize = Math.floor(batchSize / 2);
                console.log(`[${operationName}] Batch failed, retrying with size ${batchSize}`);
                // Don't increment offset - retry same batch
            } else {
                // Unrecoverable error or already at minimum batch size
                console.error(`[${operationName}] Batch operation failed:`, error);
                throw error;
            }
        }
    }
}
