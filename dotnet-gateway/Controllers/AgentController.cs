using MediMind.Gateway.Models;
using MediMind.Gateway.Services;
using Microsoft.AspNetCore.Mvc;

namespace MediMind.Gateway.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AgentController : ControllerBase
{
    private readonly IRagServiceClient _rag;
    private readonly ICacheService _cache;
    private readonly ILogger<AgentController> _log;
    private readonly TimeSpan _ttl;

    public AgentController(
        IRagServiceClient rag,
        ICacheService cache,
        IConfiguration cfg,
        ILogger<AgentController> log)
    {
        _rag = rag;
        _cache = cache;
        _log = log;
        // Agent responses are more dynamic; cache them for a shorter window.
        var ttl = cfg.GetValue<int?>("Cache:AgentTtlSeconds") ?? 600;
        _ttl = TimeSpan.FromSeconds(ttl);
    }

    [HttpPost]
    public async Task<ActionResult<AgentResponse>> Ask([FromBody] AgentRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Query))
            return BadRequest(new { error = "Query cannot be empty." });

        var key = _cache.HashKey("agent", req.Query);
        var cached = await _cache.GetAsync<AgentResponse>(key);
        if (cached is not null)
        {
            _log.LogInformation("Agent cache HIT for {Key}", key);
            return Ok(cached with { CacheHit = true });
        }

        try
        {
            var result = await _rag.AgentChatAsync(req, ct);
            if (result is null) return StatusCode(502, new { error = "Empty response from agent" });

            await _cache.SetAsync(key, result, _ttl);
            return Ok(result);
        }
        catch (HttpRequestException e)
        {
            _log.LogError(e, "Agent service call failed");
            return StatusCode(502, new { error = "Upstream agent service unavailable", detail = e.Message });
        }
    }
}
