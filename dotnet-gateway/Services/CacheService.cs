using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using StackExchange.Redis;

namespace MediMind.Gateway.Services;

public interface ICacheService
{
    Task<T?> GetAsync<T>(string key) where T : class;
    Task SetAsync<T>(string key, T value, TimeSpan ttl) where T : class;
    string HashKey(string prefix, string raw);
}

public class RedisCacheService : ICacheService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<RedisCacheService> _log;

    public RedisCacheService(IConnectionMultiplexer redis, ILogger<RedisCacheService> log)
    {
        _redis = redis;
        _log = log;
    }

    public async Task<T?> GetAsync<T>(string key) where T : class
    {
        try
        {
            var db = _redis.GetDatabase();
            var val = await db.StringGetAsync(key);
            return val.IsNullOrEmpty ? null : JsonSerializer.Deserialize<T>(val!);
        }
        catch (Exception e)
        {
            _log.LogWarning(e, "Cache GET failed for {Key}", key);
            return null;
        }
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan ttl) where T : class
    {
        try
        {
            var db = _redis.GetDatabase();
            await db.StringSetAsync(key, JsonSerializer.Serialize(value), ttl);
        }
        catch (Exception e)
        {
            _log.LogWarning(e, "Cache SET failed for {Key}", key);
        }
    }

    public string HashKey(string prefix, string raw)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(raw.Trim().ToLowerInvariant()));
        return $"{prefix}:{Convert.ToHexString(bytes)[..16]}";
    }
}
