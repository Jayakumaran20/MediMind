using MediMind.Gateway.Services;
using Polly;
using Polly.Extensions.Http;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

// Env-var overrides (docker-compose passes these in).
builder.Configuration.AddEnvironmentVariables();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Redis singleton connection.
var redisHost = builder.Configuration["REDIS_HOST"] ?? "localhost";
var redisPort = builder.Configuration["REDIS_PORT"] ?? "6379";
builder.Services.AddSingleton<IConnectionMultiplexer>(_ =>
    ConnectionMultiplexer.Connect($"{redisHost}:{redisPort},abortConnect=false"));
builder.Services.AddSingleton<ICacheService, RedisCacheService>();

// Typed HttpClient for the RAG service with retry policy.
var ragUrl = builder.Configuration["RAG_SERVICE_URL"] ?? "http://localhost:8000";
builder.Services.AddHttpClient<IRagServiceClient, RagServiceClient>(c =>
{
    c.BaseAddress = new Uri(ragUrl);
    c.Timeout = TimeSpan.FromSeconds(60);
})
.AddPolicyHandler(HttpPolicyExtensions
    .HandleTransientHttpError()
    .WaitAndRetryAsync(3, i => TimeSpan.FromMilliseconds(300 * Math.Pow(2, i))));

builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

var ttl = builder.Configuration.GetValue<int?>("CACHE_TTL_SECONDS") ?? 3600;
builder.Configuration["Cache:TtlSeconds"] = ttl.ToString();

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();
app.UseCors();
app.MapControllers();

app.MapGet("/", () => Results.Ok(new
{
    service = "MediMind Gateway",
    docs = "/swagger",
    chat = "POST /api/chat",
}));

app.Run();
