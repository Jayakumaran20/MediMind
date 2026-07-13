using System.Text.Json;
using MediMind.Gateway.Models;

namespace MediMind.Gateway.Services;

public interface IRagServiceClient
{
    Task<ChatResponse?> ChatAsync(ChatRequest req, CancellationToken ct = default);
    Task<AgentResponse?> AgentChatAsync(AgentRequest req, CancellationToken ct = default);
    Task<HealthResponse?> HealthAsync(CancellationToken ct = default);
}

public class RagServiceClient : IRagServiceClient
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    };

    private readonly HttpClient _http;
    private readonly ILogger<RagServiceClient> _log;

    public RagServiceClient(HttpClient http, ILogger<RagServiceClient> log)
    {
        _http = http;
        _log = log;
    }

    public async Task<ChatResponse?> ChatAsync(ChatRequest req, CancellationToken ct = default)
    {
        var payload = new
        {
            query = req.Query,
            top_k = req.TopK,
            conversation_id = req.ConversationId,
        };
        var resp = await _http.PostAsJsonAsync("/chat", payload, JsonOpts, ct);
        if (!resp.IsSuccessStatusCode)
        {
            var body = await resp.Content.ReadAsStringAsync(ct);
            _log.LogError("RAG service returned {Code}: {Body}", resp.StatusCode, body);
            resp.EnsureSuccessStatusCode();
        }
        return await resp.Content.ReadFromJsonAsync<ChatResponse>(JsonOpts, ct);
    }

    public async Task<AgentResponse?> AgentChatAsync(AgentRequest req, CancellationToken ct = default)
    {
        var payload = new { query = req.Query, conversation_id = req.ConversationId };
        // Agents can take longer than plain RAG (multiple LLM calls).
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(TimeSpan.FromMinutes(2));

        var resp = await _http.PostAsJsonAsync("/agent-chat", payload, JsonOpts, cts.Token);
        if (!resp.IsSuccessStatusCode)
        {
            var body = await resp.Content.ReadAsStringAsync(cts.Token);
            _log.LogError("Agent service returned {Code}: {Body}", resp.StatusCode, body);
            resp.EnsureSuccessStatusCode();
        }
        return await resp.Content.ReadFromJsonAsync<AgentResponse>(JsonOpts, cts.Token);
    }

    public async Task<HealthResponse?> HealthAsync(CancellationToken ct = default)
    {
        var resp = await _http.GetAsync("/health", ct);
        resp.EnsureSuccessStatusCode();
        return await resp.Content.ReadFromJsonAsync<HealthResponse>(JsonOpts, ct);
    }
}
