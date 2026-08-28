export const MULTI_TOKEN_BUCKET_LUA = `
local nowMs = tonumber(ARGV[1])
local numKeys = #KEYS
local results = {}
local allowAll = true

-- Phase 1: Pre-check all buckets
for i=1, numKeys do
    local key = KEYS[i]
    local capacity = tonumber(ARGV[(i-1)*3 + 2])
    local refillRatePerSecond = tonumber(ARGV[(i-1)*3 + 3])
    local cost = tonumber(ARGV[(i-1)*3 + 4])
    
    local bucketState = redis.call('HMGET', key, 'tokens', 'lastRefillMs')
    local tokens = tonumber(bucketState[1])
    local lastRefillMs = tonumber(bucketState[2])
    
    if tokens == nil then
        tokens = capacity
    end
    if lastRefillMs == nil then
        lastRefillMs = nowMs
    end
    
    local elapsedTimeMs = math.max(0, nowMs - lastRefillMs)
    local refillTokens = (elapsedTimeMs / 1000.0) * refillRatePerSecond
    
    tokens = math.min(capacity, tokens + refillTokens)
    
    if tokens < cost then
        allowAll = false
        local missingTokens = cost - tokens
        local retryAfterMs = -1
        if refillRatePerSecond > 0 then
            retryAfterMs = math.ceil((missingTokens / refillRatePerSecond) * 1000)
        end
        results[i] = {0, tokens, retryAfterMs, capacity}
    else
        results[i] = {1, tokens - cost, 0, capacity}
    end
end

local finalRes = {}

-- Phase 2: Apply changes if all allowed
if allowAll then
    for i=1, numKeys do
        local key = KEYS[i]
        local newTokens = results[i][2]
        local capacity = results[i][4]
        local refillRatePerSecond = tonumber(ARGV[(i-1)*3 + 3])
        
        redis.call('HMSET', key, 'tokens', newTokens, 'lastRefillMs', nowMs)
        
        
        -- TTL is the time required to fully refill the bucket
        if refillRatePerSecond > 0 then
            local ttlMs = math.ceil((capacity / refillRatePerSecond) * 1000)
            redis.call('PEXPIRE', key, ttlMs)
        end
        
        table.insert(finalRes, {1, math.floor(newTokens), 0})
    end
else
    -- Just return failure state without modifying anything
    for i=1, numKeys do
        -- To preserve tokens accurately, we return math.floor for display
        table.insert(finalRes, {results[i][1], math.floor(results[i][2]), results[i][3]})
    end
end

return finalRes
`;
