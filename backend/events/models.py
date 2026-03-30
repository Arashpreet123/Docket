from django.db import models


class Event(models.Model):
    source = models.CharField(max_length=100)
    type = models.CharField(max_length=100)
    value = models.FloatField()
    timestamp = models.DateTimeField(auto_now_add=True)
    alert = models.BooleanField(default=False)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.source} — {self.type}: {self.value}"