using MediMind.Gateway.Models;
using MediMind.Gateway.Services;
using Microsoft.AspNetCore.Mvc;

namespace MediMind.Gateway.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ChatController : ControllerBase
{
    private readonly IRagServiceClient _rag;
    private readonly ICacheService _cache;
    private readonly ILogger<ChatController> _log;
    private readonly TimeSpan _ttl;

    public ChatController(
        IRagServiceClient rag,
        ICacheService cache,
        IConfiguration cfg,
        ILogger<ChatController> log)
    {
        _rag = rag;
        _cache = cache;
        _log = log;
        var ttl = cfg.GetValue<int?>("Cache:TtlSeconds") ?? 3600;
        _ttl = TimeSpan.FromSeconds(ttl);
    }

    [HttpPost]
    public async Task<ActionResult<ChatResponse>> Ask([FromBody] ChatRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Query))
            return BadRequest(new { error = "Query cannot be empty." });

        var key = _cache.HashKey("chat", req.Query);
        var cached = await _cache.GetAsync<ChatResponse>(key);
        if (cached is not null)
        {
            _log.LogInformation("Cache HIT for {Key}", key);
            return Ok(cached with { CacheHit = true });
        }

        try
        {
            var result = await _rag.ChatAsync(req, ct);
            if (result is null) return StatusCode(502, new { error = "Empty response from RAG service" });

            await _cache.SetAsync(key, result, _ttl);
            return Ok(result);
        }
        catch (HttpRequestException e)
        {
            _log.LogError(e, "RAG service call failed");
            return StatusCode(502, new { error = "Upstream RAG service unavailable", detail = e.Message });
        }
    }

    [HttpGet("health")]
    public async Task<ActionResult<HealthResponse>> Health(CancellationToken ct)
    {
        try
        {
            var h = await _rag.HealthAsync(ct);
            return h is null ? StatusCode(502) : Ok(h);
        }
        catch (Exception e)
        {
            return StatusCode(503, new { error = "RAG service unreachable", detail = e.Message });
        }
    }
}
