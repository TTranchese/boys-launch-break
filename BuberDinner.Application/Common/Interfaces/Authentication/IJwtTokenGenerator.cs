using BuberDinner.Domain.Entities;

namespace BuberDinner.Application.Services.Authentication;

public interface IJwtTokenGenerator
{
    string GenerateToken(User user);

}