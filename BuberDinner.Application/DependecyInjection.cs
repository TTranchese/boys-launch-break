using MediatR;
using Microsoft.Extensions.DependencyInjection;

namespace BuberDinner.Application;
public static class DependecyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddMediatR(typeof(DependecyInjection).Assembly);
        return services;
    }
}