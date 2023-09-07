using BuberDinner.Application.Services.Authentication;
using Microsoft.Extensions.DependencyInjection.Extensions;
using BuberDinner.Application;
using BuberDinner.Infrastructure;
var builder = WebApplication.CreateBuilder(args);
{
    builder.Services
        .AddInfrastructure(builder.Configuration)
        .AddApplication();
    builder.Services.AddControllers();
}

var app = builder.Build();
{
    app.UseHttpsRedirection();
    app.MapControllers();
    app.Run();
}

