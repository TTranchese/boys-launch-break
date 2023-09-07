using BuberDinner.Application.Services.Authentication;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace BuberDinner.Application;
public static class DependecyInjection 
{
    public static IServiceCollection AddApplication(this IServiceCollection services) 
    {
        services.AddScoped<IAuthenticationService, AuthenticationService>();
        return services;
    }
}