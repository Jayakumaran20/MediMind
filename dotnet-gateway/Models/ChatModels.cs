namespace MediMind.Gateway.Models;

public record ChatRequest(string Query, int? TopK = null, string? ConversationId = null);

public record Source(string Content, Dictionary<string, object> Metadata, double? Score);

public record ChatResponse(
    string Answer,
    List<Source> Sources,
    string Model,
    string? ConversationId,
    bool CacheHit = false);

public record HealthResponse(string Status, int VectorStoreDocs, string Model);

public record AgentRequest(string Query, string? ConversationId = null);

public record TraceStep(
    string Type,
    string? Content = null,
    string? Tool = null,
    List<Dictionary<string, object>>? ToolCalls = null);

public record AgentResponse(
    string Answer,
    List<TraceStep> Trace,
    int ToolCallCount,
    int Steps,
    string Model,
    string? ConversationId,
    bool CacheHit = false);
